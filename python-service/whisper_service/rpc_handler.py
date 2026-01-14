"""JSON-RPC 2.0 Handler for WhisperX operations"""
import json
import sys
from typing import Any, Dict, Optional, Callable


class RPCHandler:
    def __init__(self, transcriber):
        self.transcriber = transcriber
        self.methods: Dict[str, Callable] = {
            "initialize": self._initialize,
            "transcribe": self._transcribe,
            "cancel": self._cancel,
            "get_status": self._get_status,
            "shutdown": self._shutdown,
        }

    def handle(self, request: dict) -> Optional[dict]:
        """Handle incoming JSON-RPC request"""
        # Validate JSON-RPC 2.0 structure
        if request.get("jsonrpc") != "2.0":
            return self._error(-32600, "Invalid Request", request.get("id"))

        method = request.get("method")
        params = request.get("params", {})
        req_id = request.get("id")  # None for notifications

        if method not in self.methods:
            return self._error(-32601, f"Method not found: {method}", req_id)

        try:
            result = self.methods[method](params)
            if req_id is not None:  # Only respond to requests, not notifications
                return {"jsonrpc": "2.0", "result": result, "id": req_id}
        except Exception as e:
            return self._error(-32603, str(e), req_id)

        return None

    def _initialize(self, params: dict) -> dict:
        """Initialize WhisperX models with configuration"""
        model_name = params.get("model", "large-v3")
        language = params.get("language", "de")
        device = params.get("device", "mps")
        compute_type = params.get("compute_type", "float16")
        hf_token = params.get("hf_token")

        # Progress callback sends notifications during model loading
        def on_progress(stage: str, percent: float, message: str = ""):
            self._send_notification("progress", {
                "stage": stage,
                "percent": percent,
                "message": message
            })

        self.transcriber.initialize(
            model_name=model_name,
            language=language,
            device=device,
            compute_type=compute_type,
            hf_token=hf_token,
            progress_callback=on_progress
        )
        return {"status": "initialized", "model": model_name}

    def _transcribe(self, params: dict) -> dict:
        """Start transcription with progress reporting"""
        audio_path = params["audio_path"]
        options = {
            "language": params.get("language", "de"),
        }

        # Progress callback sends notifications
        def on_progress(stage: str, percent: float, message: str = ""):
            self._send_notification("progress", {
                "stage": stage,
                "percent": percent,
                "message": message
            })

        result = self.transcriber.transcribe(audio_path, options, on_progress)
        return result

    def _cancel(self, params: dict) -> dict:
        """Cancel ongoing transcription"""
        self.transcriber.cancel()
        return {"status": "cancelled"}

    def _get_status(self, params: dict) -> dict:
        """Get current service status"""
        return self.transcriber.get_status()

    def _shutdown(self, params: dict) -> dict:
        """Graceful shutdown"""
        self.transcriber.cleanup()
        return {"status": "shutdown"}

    def _error(self, code: int, message: str, req_id: Optional[int]) -> dict:
        return {
            "jsonrpc": "2.0",
            "error": {"code": code, "message": message},
            "id": req_id
        }

    def _send_notification(self, method: str, params: dict):
        """Send progress notification to stdout"""
        notification = {"jsonrpc": "2.0", "method": method, "params": params}
        print(json.dumps(notification), flush=True)
