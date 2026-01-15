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
        self.whisper_model = None  # Cache the loaded Whisper model
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
        hf_token: Optional[str] = None,
        progress_callback: Optional[Callable] = None
    ):
        """Load all required models including Whisper model for instant transcription"""
        # Skip if already initialized to prevent reloading the ~6GB model
        if self.is_initialized and self.whisper_model is not None:
            logger.info("WhisperX-MLX already initialized, skipping re-initialization")
            if progress_callback:
                progress_callback("initializing", 100, "KI-Modelle bereits geladen")
            return

        import whisperx_mlx

        logger.info(f"Initializing WhisperX-MLX with model={model_name}, backend=mlx")

        self.device = device
        self.language = language
        self.model_name = model_name

        # Stage 1: Load alignment model for word-level timestamps (0-30%)
        if progress_callback:
            progress_callback("initializing", 0, "Lade Alignment-Modell...")

        logger.info("Loading alignment model...")
        self.align_model, self.align_metadata = whisperx_mlx.load_align_model(
            language_code=language,
            device="cpu"  # Alignment model runs on CPU
        )

        if progress_callback:
            progress_callback("initializing", 30, "Alignment-Modell geladen")

        # Stage 2: Load and cache Whisper model (30-100%)
        if progress_callback:
            progress_callback("initializing", 35, f"Lade Whisper {model_name} Modell...")

        logger.info(f"Loading Whisper model: {model_name}")

        if progress_callback:
            progress_callback("initializing", 50, "Initialisiere MLX-Backend...")

        # Load the model once and cache it for reuse
        # This prevents reloading the ~6GB model for every transcription
        try:
            from whisperx_mlx.backends import load_model
            self.whisper_model = load_model(
                model_name=model_name,
                backend="mlx",
                device=device,
                language=language
            )
            logger.info(f"Whisper model {model_name} loaded and cached successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise

        if progress_callback:
            progress_callback("initializing", 100, "KI-Modelle geladen")

        self.is_initialized = True
        logger.info("WhisperX-MLX initialization complete - models pre-loaded")

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

            # Stage 2: Transcribe with cached MLX model
            if progress_callback:
                progress_callback("transcribing", 10, "Transkribiere mit MLX (GPU)...")

            logger.info("Starting MLX transcription with cached model...")

            # Use the cached pipeline to avoid reloading ~6GB for every transcription
            # Call transcribe directly on the cached pipeline instance
            result = self.whisper_model.transcribe(
                audio_path,
                language=options.get("language", self.language),
                batch_size=16,
                print_progress=False,
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
            formatted = self._format_result(result, duration)

            # Explicitly delete large objects to free memory
            del audio
            del result

            return formatted

        finally:
            with self._lock:
                self.is_processing = False
            # Aggressive memory cleanup
            gc.collect()
            gc.collect()  # Run twice to ensure cyclic references are cleaned
            # Clear MLX GPU cache to free Metal memory
            try:
                import mlx.core as mx
                mx.clear_cache()
                logger.info(f"MLX memory after cleanup: active={mx.get_active_memory() / 1e9:.2f}GB, cache={mx.get_cache_memory() / 1e9:.2f}GB")
            except Exception as e:
                logger.warning(f"Failed to clear MLX cache: {e}")

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

    def align_text(
        self,
        audio_path: str,
        segments: List[Dict[str, Any]],
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Forced alignment: Align given text segments with audio.
        Used after AI corrections to get accurate word-level timestamps.

        Args:
            audio_path: Path to audio file
            segments: List of segments with 'text', 'start', 'end'
                     e.g. [{"text": "Hello world", "start": 0.0, "end": 2.0}]
            progress_callback: Optional progress callback

        Returns:
            Dict with aligned segments containing word-level timestamps
        """
        import whisperx_mlx

        if not self.is_initialized:
            raise RuntimeError("WhisperTranscriber not initialized")

        with self._lock:
            self.is_processing = True
            self.cancel_requested = False

        try:
            # Load audio
            if progress_callback:
                progress_callback("loading", 0, "Lade Audio für Alignment...")

            logger.info(f"Loading audio for alignment from {audio_path}")
            audio = whisperx_mlx.audio.load_audio(audio_path)

            if self._check_cancelled():
                return {"cancelled": True}

            # Run forced alignment
            if progress_callback:
                progress_callback("aligning", 50, "Führe Wort-Alignment durch...")

            logger.info(f"Running forced alignment on {len(segments)} segments...")
            result = whisperx_mlx.align(
                segments,
                self.align_model,
                self.align_metadata,
                audio,
                "cpu",  # Alignment on CPU
                return_char_alignments=False
            )

            if self._check_cancelled():
                return {"cancelled": True}

            if progress_callback:
                progress_callback("complete", 100, "Alignment abgeschlossen")

            # Format output
            duration = len(audio) / 16000
            formatted = self._format_result(result, duration)

            # Explicitly delete large objects
            del audio
            del result

            return formatted

        finally:
            with self._lock:
                self.is_processing = False
            # Aggressive memory cleanup
            gc.collect()
            gc.collect()
            try:
                import mlx.core as mx
                mx.clear_cache()
            except Exception:
                pass

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
        self.whisper_model = None  # Release the ~6GB cached model
        self.align_model = None
        self.align_metadata = None
        self.is_initialized = False
        gc.collect()
