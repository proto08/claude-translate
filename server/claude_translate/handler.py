"""HTTP layer: Host/Origin/token guard, request validation, JSON responses."""
import json
import secrets
import subprocess
import sys
from http.server import BaseHTTPRequestHandler

from .config import DEFAULT_MODEL, MAX_BODY, MAX_CHARS, MAX_ITEMS
from .translator import translate


class Handler(BaseHTTPRequestHandler):
    server_version = "claude-translate"
    token = ""
    port = 0
    model = DEFAULT_MODEL

    def log_message(self, fmt, *args):  # quiet
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin", "")
        if origin.startswith("moz-extension://"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def _guard(self) -> bool:
        host = self.headers.get("Host", "")
        if host not in (f"127.0.0.1:{self.port}", f"localhost:{self.port}"):
            self._send(403, {"error": "bad host"})
            return False
        origin = self.headers.get("Origin", "")
        if origin and not origin.startswith("moz-extension://"):
            self._send(403, {"error": "bad origin"})
            return False
        return True

    def do_OPTIONS(self):
        if not self._guard():
            return
        self.send_response(204)
        origin = self.headers.get("Origin", "")
        if origin.startswith("moz-extension://"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_POST(self):
        if not self._guard():
            return
        if self.path != "/translate":
            return self._send(404, {"error": "not found"})
        auth = self.headers.get("Authorization", "")
        if not secrets.compare_digest(auth, f"Bearer {self.token}"):
            return self._send(401, {"error": "unauthorized"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = -1
        if n <= 0 or n > MAX_BODY:
            return self._send(413, {"error": "bad size"})
        try:
            data = json.loads(self.rfile.read(n))
            texts = data["texts"]
            assert isinstance(texts, list) and all(isinstance(t, str) for t in texts)
            assert 0 < len(texts) <= MAX_ITEMS and sum(map(len, texts)) <= MAX_CHARS
        except Exception:
            return self._send(400, {"error": "bad request"})
        try:
            self._send(200, {"translations": translate(texts, self.model)})
        except subprocess.TimeoutExpired:
            self._send(504, {"error": "claude timed out"})
        except Exception as e:  # noqa: BLE001
            self._send(502, {"error": str(e)})
