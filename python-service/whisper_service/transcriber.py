"""WhisperX-MLX transcription pipeline wrapper for Apple Silicon"""
import gc
import os
import sys
import threading
import logging
from typing import Optional, Callable, Dict, Any, List

# Don't disable progress bars - we redirect them to stderr for debug visibility
# The JSON-RPC communication uses stdout only, stderr is for logs
# os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
# os.environ["TQDM_DISABLE"] = "1"

logger = logging.getLogger(__name__)


class ProgressTqdm:
    """Custom tqdm-like class that sends progress to a callback instead of printing."""

    def __init__(self, total=None, desc=None, unit='B', unit_scale=True, progress_callback=None, stage='initializing', **kwargs):
        self.total = total
        self.desc = desc or "Downloading"
        self.n = 0
        self.progress_callback = progress_callback
        self.stage = stage
        self.last_percent = -1

    def update(self, n=1):
        self.n += n
        if self.total and self.progress_callback:
            percent = (self.n / self.total) * 100
            # Only send update every 1% to reduce noise
            int_percent = int(percent)
            if int_percent != self.last_percent:
                self.last_percent = int_percent
                # Map download progress (0-100) to overall progress (35-90)
                mapped_percent = 35 + (percent * 0.55)  # 35-90% range
                size_mb = self.n / (1024 * 1024)
                total_mb = self.total / (1024 * 1024)
                message = f"{self.desc}: {size_mb:.1f} / {total_mb:.1f} MB ({int_percent}%)"
                self.progress_callback(self.stage, mapped_percent, message)

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


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

        if progress_callback:
            progress_callback("initializing", 2, "Starte Python-Umgebung...")

        logger.info(f"Initializing WhisperX-MLX with model={model_name}, backend=mlx")
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Working directory: {os.getcwd()}")

        self.device = device
        self.language = language
        self.model_name = model_name

        # Stage 1: Import required libraries (2-15%)
        # This import can take 30-60+ seconds on first run as it loads PyTorch, MLX, etc.
        if progress_callback:
            progress_callback("initializing", 5, "Importiere KI-Bibliotheken (kann 30-60 Sek. dauern)...")

        logger.info("Starting import of whisperx_mlx - this loads PyTorch, MLX, transformers...")
        logger.info("This may take 30-60 seconds on first run...")

        # Start a background ticker to show progress during the long import
        import time
        import_complete = threading.Event()

        def import_ticker():
            """Send periodic updates during the long import phase"""
            start_time = time.time()
            current_percent = 5
            tick_count = 0

            while not import_complete.is_set() and current_percent < 14:
                time.sleep(2)  # Update every 2 seconds
                if import_complete.is_set():
                    break

                tick_count += 1
                elapsed = int(time.time() - start_time)

                # Slowly increment from 5% to 14%
                current_percent = min(5 + (tick_count * 0.5), 14)

                messages = [
                    "Lade PyTorch Framework...",
                    "Lade MLX Metal-Backend...",
                    "Lade Transformers-Bibliothek...",
                    "Lade Audio-Verarbeitung...",
                    "Initialisiere Modell-Pipeline...",
                ]
                msg = messages[min(tick_count // 3, len(messages) - 1)]

                if progress_callback and not import_complete.is_set():
                    progress_callback("initializing", current_percent, f"{msg} ({elapsed}s)")
                    logger.info(f"Import still running... ({elapsed}s elapsed)")

        ticker_thread = threading.Thread(target=import_ticker, daemon=True)
        ticker_thread.start()

        try:
            import whisperx_mlx
            logger.info("whisperx_mlx imported successfully")
        except Exception as e:
            logger.error(f"Failed to import whisperx_mlx: {e}")
            raise
        finally:
            import_complete.set()
            ticker_thread.join(timeout=1)

        if progress_callback:
            progress_callback("initializing", 15, "Bibliotheken geladen")

        # Stage 2: Load alignment model for word-level timestamps (15-35%)
        if progress_callback:
            progress_callback("initializing", 17, "Lade Alignment-Modell fuer Wort-Timing...")

        logger.info(f"Loading alignment model for language: {language}")
        try:
            self.align_model, self.align_metadata = whisperx_mlx.load_align_model(
                language_code=language,
                device="cpu"  # Alignment model runs on CPU
            )
            logger.info("Alignment model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load alignment model: {e}")
            if progress_callback:
                progress_callback("initializing", 17, f"Fehler beim Laden des Alignment-Modells: {e}")
            raise

        if progress_callback:
            progress_callback("initializing", 35, "Alignment-Modell geladen")

        # Stage 3: Load and cache Whisper model (35-95%)
        if progress_callback:
            progress_callback("initializing", 37, f"Bereite Whisper {model_name} Download vor...")

        logger.info(f"Loading Whisper model: {model_name}")
        logger.info("This may download ~2-3 GB on first run...")

        if progress_callback:
            progress_callback("initializing", 40, f"Lade Whisper {model_name} (kann bei erstem Start einige Minuten dauern)...")

        # Load the model once and cache it for reuse
        # This prevents reloading the ~6GB model for every transcription
        try:
            from whisperx_mlx.backends import load_model
            import time

            # Store progress callback for potential use in download progress
            self._progress_callback = progress_callback

            logger.info("Calling load_model - this triggers HuggingFace download if needed...")

            if progress_callback:
                progress_callback("initializing", 40, "Verbinde mit HuggingFace Hub...")

            # Start a background thread to provide progress updates during long download
            load_complete = threading.Event()
            load_error = [None]  # Use list to allow modification in thread

            def progress_ticker():
                """Send periodic progress updates during model loading"""
                start_time = time.time()
                current_percent = 45
                messages = [
                    "Lade Modell-Gewichte...",
                    "Download laeuft (kann einige Minuten dauern)...",
                    "Verarbeite Modelldaten...",
                    "Entpacke MLX-Tensoren...",
                    "Optimiere fuer Metal GPU...",
                    "Fast fertig..."
                ]
                msg_index = 0

                while not load_complete.is_set() and current_percent < 88:
                    time.sleep(2)  # Update every 2 seconds for more responsive feedback
                    if load_complete.is_set():
                        break

                    # Slowly increment progress (slower as we approach 88%)
                    if current_percent < 60:
                        current_percent += 1.5
                    elif current_percent < 75:
                        current_percent += 1
                    else:
                        current_percent += 0.5

                    elapsed = int(time.time() - start_time)
                    elapsed_str = f"{elapsed // 60}:{elapsed % 60:02d}"

                    msg = messages[min(msg_index, len(messages) - 1)]
                    if elapsed > 20 and msg_index < len(messages) - 1:
                        msg_index += 1

                    if progress_callback and not load_complete.is_set():
                        progress_callback("initializing", min(current_percent, 88), f"{msg} ({elapsed_str})")
                        logger.info(f"Model loading... {current_percent:.0f}% ({elapsed_str})")

            # Start progress ticker thread
            ticker_thread = threading.Thread(target=progress_ticker, daemon=True)
            ticker_thread.start()

            try:
                self.whisper_model = load_model(
                    model_name=model_name,
                    backend="mlx",
                    device=device,
                    language=language
                )
            finally:
                load_complete.set()  # Signal ticker to stop
                ticker_thread.join(timeout=1)  # Wait for ticker to stop

            logger.info(f"Whisper model {model_name} loaded and cached successfully")

            if progress_callback:
                progress_callback("initializing", 92, "Whisper-Modell geladen, finalisiere...")

        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            if progress_callback:
                progress_callback("initializing", 40, f"Fehler: {e}")
            raise

        # Stage 4: Final initialization (95-100%)
        if progress_callback:
            progress_callback("initializing", 95, "Initialisiere MLX Metal-Backend...")

        # Warm up MLX
        try:
            import mlx.core as mx
            logger.info(f"MLX backend initialized - Device: {mx.default_device()}")
            logger.info(f"MLX memory: active={mx.get_active_memory() / 1e9:.2f}GB, cache={mx.get_cache_memory() / 1e9:.2f}GB")
        except Exception as e:
            logger.warning(f"Could not get MLX memory info: {e}")

        if progress_callback:
            progress_callback("initializing", 100, "KI-Modelle erfolgreich geladen")

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
