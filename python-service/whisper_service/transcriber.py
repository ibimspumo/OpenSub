"""WhisperX-MLX transcription pipeline wrapper for Apple Silicon"""
import gc
import os
import sys
import threading
import logging
from typing import Optional, Callable, Dict, Any, List

# Suppress progress bars and verbose output that interferes with JSON-RPC
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TQDM_DISABLE"] = "1"

logger = logging.getLogger(__name__)


class WhisperTranscriber:
    def __init__(self):
        self.align_model = None
        self.align_metadata = None
        self.device = "mps"  # MLX uses Metal/MPS on Apple Silicon
        self.language = "de"
        self.model_name = "large-v3"
        self.is_initialized = False
        self.is_processing = False
        self.cancel_requested = False
        self._lock = threading.Lock()

    def initialize(
        self,
        model_name: str = "large-v3",
        language: str = "de",
        device: str = "mps",
        compute_type: str = "float16",
        hf_token: Optional[str] = None
    ):
        """Load all required models"""
        import whisperx_mlx

        logger.info(f"Initializing WhisperX-MLX with model={model_name}, backend=mlx")

        self.device = device
        self.language = language
        self.model_name = model_name

        # Load alignment model for word-level timestamps
        logger.info("Loading alignment model...")
        self.align_model, self.align_metadata = whisperx_mlx.load_align_model(
            language_code=language,
            device="cpu"  # Alignment model runs on CPU
        )

        self.is_initialized = True
        logger.info("WhisperX-MLX initialization complete")

    def transcribe(
        self,
        audio_path: str,
        options: Dict[str, Any],
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Full transcription pipeline:
        1. Transcribe with Whisper (MLX backend)
        2. Align for word-level timestamps
        """
        import whisperx_mlx

        with self._lock:
            self.is_processing = True
            self.cancel_requested = False

        try:
            # Stage 1: Load audio
            if progress_callback:
                progress_callback("loading", 0, "Lade Audio-Datei...")

            logger.info(f"Loading audio from {audio_path}")
            audio = whisperx_mlx.audio.load_audio(audio_path)
            duration = len(audio) / 16000  # Sample rate

            if self._check_cancelled():
                return {"cancelled": True}

            # Stage 2: Transcribe with MLX backend
            if progress_callback:
                progress_callback("transcribing", 10, "Transkribiere mit MLX (GPU)...")

            logger.info("Starting MLX transcription...")
            result = whisperx_mlx.transcribe(
                audio_path,
                model=self.model_name,
                backend="mlx",  # Force MLX backend for Apple Silicon
                language=options.get("language", self.language),
                batch_size=16,
                print_progress=False,  # Disable to avoid JSON-RPC interference
                verbose=False
            )

            if self._check_cancelled():
                return {"cancelled": True}

            # Stage 3: Align for word-level timestamps
            if progress_callback:
                progress_callback("aligning", 50, "Synchronisiere Wort-Zeitstempel...")

            logger.info("Aligning word timestamps...")
            result = whisperx_mlx.align(
                result["segments"],
                self.align_model,
                self.align_metadata,
                audio,
                "cpu",  # Alignment on CPU
                return_char_alignments=False
            )

            if self._check_cancelled():
                return {"cancelled": True}

            if progress_callback:
                progress_callback("complete", 100, "Transkription abgeschlossen")

            # Format output
            return self._format_result(result, duration)

        finally:
            with self._lock:
                self.is_processing = False
            # Clean up memory
            gc.collect()

    def _format_result(
        self,
        result: Dict,
        duration: float
    ) -> Dict[str, Any]:
        """Format WhisperX output to structured result"""
        segments = []

        for seg in result["segments"]:
            words = []
            for word in seg.get("words", []):
                words.append({
                    "word": word.get("word", ""),
                    "start": word.get("start", 0),
                    "end": word.get("end", 0),
                    "score": word.get("score", 0)
                })

            segments.append({
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", ""),
                "words": words
            })

        return {
            "segments": segments,
            "language": result.get("language", self.language),
            "duration": duration
        }

    def cancel(self):
        """Request cancellation of current operation"""
        with self._lock:
            self.cancel_requested = True
        logger.info("Cancellation requested")

    def _check_cancelled(self) -> bool:
        with self._lock:
            return self.cancel_requested

    def get_status(self) -> Dict[str, Any]:
        """Get current service status"""
        return {
            "initialized": self.is_initialized,
            "processing": self.is_processing,
            "device": self.device,
            "language": self.language
        }

    def cleanup(self):
        """Release all resources"""
        logger.info("Cleaning up WhisperX-MLX resources...")
        self.align_model = None
        gc.collect()
