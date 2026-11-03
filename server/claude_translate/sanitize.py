"""Prompt-injection hardening: input sanitizing, output validation, strict parsing.

Keep in sync with the extension-side visibility filter (extension/src/content/collect.ts).
"""

import json
import re
import unicodedata

_URL_RE = re.compile(r"https?://[^\s\"'<>)\]]+", re.I)
_BAD_CATEGORIES = ("Cf", "Cc", "Co", "Cs")


def sanitize_input(t: str) -> str:
    """Drop invisible/format characters (zero-width, bidi overrides, Unicode 'tag' characters
    used for hidden instructions) and control chars; collapse whitespace."""
    t = "".join(ch for ch in t if unicodedata.category(ch) not in _BAD_CATEGORIES or ch in "\n\t")
    return re.sub(r"\s+", " ", t).strip()


def output_ok(src: str, out: str) -> bool:
    """Reject translations that look hijacked. Output may not:
    be empty/absurdly long, contain control/format chars, or introduce URLs absent from the source."""
    if not out.strip():
        return False
    if len(out) > 3 * len(src) + 60:
        return False
    if any(unicodedata.category(c) in _BAD_CATEGORIES and c not in "\n\t" for c in out):
        return False
    for u in _URL_RE.findall(out):
        if u.rstrip(".,;:!?、。") not in src:
            return False
    return True


def parse_json_array(s: str) -> list[str] | None:
    """Strict: the whole output must be a JSON array of strings (a code fence is tolerated).
    No 'find an array somewhere in the prose' fallback - that would accept hijacked output."""
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    try:
        v = json.loads(s)
    except json.JSONDecodeError:
        return None
    if isinstance(v, list) and all(isinstance(x, str) for x in v):
        return v
    return None
