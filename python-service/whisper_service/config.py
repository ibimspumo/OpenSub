"""Configuration for WhisperX service"""
import os


class WhisperConfig:
    """Configuration optimized for M2 Max"""

    # Model settings
    MODEL_NAME = os.environ.get("WHISPER_MODEL", "large-v3")
    COMPUTE_TYPE = "float16"  # Good balance of speed/accuracy

    # Batch size - can be aggressive with 96GB
    BATCH_SIZE = 16

    # Language
    DEFAULT_LANGUAGE = "de"

    # Device selection
    @staticmethod
    def get_device() -> str:
        try:
            import torch
            if torch.backends.mps.is_available():
                return "mps"
        except ImportError:
            pass
        return "cpu"

    # HuggingFace token from environment
    @staticmethod
    def get_hf_token() -> str:
        return os.environ.get("HF_TOKEN", "")
