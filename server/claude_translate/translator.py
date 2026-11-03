"""Translation policy on top of run_claude: sanitize, cache, validate, retry suspicious items alone."""

import hashlib
import sys
import threading

from .claude import run_claude
from .config import CACHE_MAX_ENTRIES
from .sanitize import output_ok, sanitize_input

_cache: dict[str, str] = {}
_cache_lock = threading.Lock()


def _key(model: str, text: str) -> str:
    return hashlib.sha256(f"{model}\0{text}".encode()).hexdigest()


def translate(texts: list[str], model: str) -> list[str | None]:
    """Returns one entry per input; None = untranslated (client leaves the original text)."""
    texts = [sanitize_input(t) for t in texts]
    keys = [_key(model, t) for t in texts]
    result: list[str | None] = [None] * len(texts)
    todo = []
    with _cache_lock:
        for i, k in enumerate(keys):
            if k in _cache:
                result[i] = _cache[k]
            elif texts[i]:
                todo.append(i)
    if todo:
        out = run_claude([texts[i] for i in todo], model)
        bad = [i for i, o in zip(todo, out, strict=True) if not output_ok(texts[i], o)]
        good = {i: o for i, o in zip(todo, out, strict=True) if i not in bad}
        # A suspicious item may have been steered by a neighbour in the same batch:
        # retry each alone (no other page text in context); still bad -> leave untranslated.
        for i in bad:
            print(f"[warn] output rejected, retrying alone: {texts[i][:60]!r}", file=sys.stderr)
            try:
                o = run_claude([texts[i]], model)[0]
                if output_ok(texts[i], o):
                    good[i] = o
            except Exception:  # noqa: BLE001
                pass
        with _cache_lock:
            if len(_cache) > CACHE_MAX_ENTRIES:
                _cache.clear()
            for i, o in good.items():
                result[i] = o
                _cache[keys[i]] = o
    return result
