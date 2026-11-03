"""Limits and token file handling."""
import os
import secrets
from pathlib import Path

# Request caps. The extension's batch limits (extension/src/content/batch.ts) must stay under these.
MAX_BODY = 512 * 1024      # bytes per request
MAX_ITEMS = 200            # texts per request
MAX_CHARS = 40_000         # total chars per request
CLAUDE_TIMEOUT = 180       # seconds
MAX_CLAUDE_PROCS = 3       # concurrent claude processes
CACHE_MAX_ENTRIES = 20_000

DEFAULT_PORT = 8787
DEFAULT_MODEL = "haiku"


def token_path() -> Path:
    base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "claude-translate" / "token"


def load_token() -> str:
    p = token_path()
    if p.exists():
        return p.read_text().strip()
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tok = secrets.token_urlsafe(32)
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(tok)
    return tok
