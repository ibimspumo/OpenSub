#!/usr/bin/env python3
"""
WhisperX Service - JSON-RPC over stdio
Communicates with Electron main process via stdin/stdout
"""
import sys
import json
import logging
from typing import Optional

# Configure logging to stderr (stdout reserved for JSON-RPC)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)


def send_response(response: dict):
    """Send JSON-RPC response to stdout"""
    print(json.dumps(response), flush=True)


def send_notification(method: str, params: dict):
    """Send JSON-RPC notification (no id, no response expected)"""
    notification = {"jsonrpc": "2.0", "method": method, "params": params}
    print(json.dumps(notification), flush=True)


def send_error(code: int, message: str, req_id: Optional[int] = None):
    """Send JSON-RPC error response"""
    error_response = {
        "jsonrpc": "2.0",
        "error": {"code": code, "message": message},
        "id": req_id
    }
    print(json.dumps(error_response), flush=True)


def main():
    """Main entry point - runs JSON-RPC event loop"""
    from whisper_service.rpc_handler import RPCHandler
    from whisper_service.transcriber import WhisperTranscriber

    logger.info("WhisperX service starting...")

    # Initialize components
    transcriber = WhisperTranscriber()
    handler = RPCHandler(transcriber)

    # Signal readiness to parent process
    send_notification("ready", {"version": "1.0.0"})

    # Main event loop - read JSON-RPC messages from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            response = handler.handle(request)
            if response:  # Don't respond to notifications
                send_response(response)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            send_error(-32700, f"Parse error: {e}")
        except Exception as e:
            logger.exception("Unexpected error")
            send_error(-32603, f"Internal error: {e}")


if __name__ == "__main__":
    main()
