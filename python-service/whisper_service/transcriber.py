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
        self.diarize_pipeline = None
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

        # Use HF_TOKEN from environment if not provided
        if not hf_token:
            hf_token = os.environ.get("HF_TOKEN", "")

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

        # Load diarization pipeline (requires HuggingFace token)
        if hf_token:
            logger.info("Loading diarization pipeline...")
            try:
                self.diarize_pipeline = whisperx_mlx.DiarizationPipeline(
                    use_auth_token=hf_token,
                    device="cpu"  # Diarization runs on CPU
                )
            except Exception as e:
                logger.warning(f"Could not load diarization pipeline: {e}")
                self.diarize_pipeline = None
        else:
            logger.warning("No HuggingFace token provided, diarization disabled")

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
        3. Diarize for speaker identification
        4. Combine results
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

            # Stage 4: Speaker diarization
            speakers = []
            if options.get("diarize", True) and self.diarize_pipeline:
                if progress_callback:
                    progress_callback("diarizing", 70, "Identifiziere Sprecher...")

                logger.info("Running speaker diarization...")
                try:
                    diarize_segments = self.diarize_pipeline(
                        audio_path,
                        min_speakers=options.get("min_speakers"),
                        max_speakers=options.get("max_speakers")
                    )

                    # Assign speakers to words
                    result = whisperx_mlx.assign_word_speakers(diarize_segments, result)

                    # Extract unique speakers
                    speakers = list(set(
                        seg.get("speaker", "UNKNOWN")
                        for seg in result["segments"]
                        if seg.get("speaker")
                    ))
                except Exception as e:
                    logger.warning(f"Diarization failed: {e}")

            if progress_callback:
                progress_callback("complete", 100, "Transkription abgeschlossen")

            # Format output
            return self._format_result(result, duration, speakers)

        finally:
            with self._lock:
                self.is_processing = False
            # Clean up memory
            gc.collect()

    def _format_result(
        self,
        result: Dict,
        duration: float,
        speakers: List[str]
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
                    "score": word.get("score", 0),
                    "speaker": word.get("speaker")
                })

            segments.append({
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", ""),
                "speaker": seg.get("speaker"),
                "words": words
            })

        return {
            "segments": segments,
            "language": result.get("language", self.language),
            "duration": duration,
            "speakers": speakers
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
        self.diarize_pipeline = None
        gc.collect()
