"""Argument parsing and server startup."""
import argparse
from http.server import ThreadingHTTPServer

from .config import DEFAULT_MODEL, DEFAULT_PORT, load_token, token_path
from .handler import Handler


def main() -> None:
    ap = argparse.ArgumentParser(prog="claude-translate")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--model", default=DEFAULT_MODEL,
                    help=f"claude model alias or id (default: {DEFAULT_MODEL})")
    ap.add_argument("--show-token", action="store_true", help="print token and exit")
    a = ap.parse_args()

    tok = load_token()
    if a.show_token:
        print(tok)
        return
    Handler.token, Handler.port, Handler.model = tok, a.port, a.model
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    print(f"listening on http://127.0.0.1:{a.port}  model={a.model}")
    print(f"token file: {token_path()}  (uv run claude-translate --show-token)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
