package main

// Prompt-injection hardening: input sanitizing, output validation, strict parsing.
// Keep in sync with the extension-side visibility filter (extension/src/content/collect.ts).

import (
	"encoding/json"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	urlRe   = regexp.MustCompile(`(?i)https?://[^\s"'<>)\]]+`)
	fenceRe = regexp.MustCompile("^```(?:json)?\\s*|\\s*```$")
)

// isBad reports invisible/format/control/private-use/surrogate characters (Cf, Cc, Co, Cs).
func isBad(r rune) bool {
	return unicode.In(r, unicode.Cf, unicode.Cc, unicode.Co, unicode.Cs)
}

// sanitizeInput drops invisible/format characters (zero-width, bidi overrides, Unicode "tag"
// characters used for hidden instructions) and control chars; collapses whitespace.
func sanitizeInput(t string) string {
	t = strings.ToValidUTF8(t, "")
	t = strings.Map(func(r rune) rune {
		if isBad(r) && r != '\n' && r != '\t' {
			return -1
		}
		return r
	}, t)
	return strings.Join(strings.Fields(t), " ")
}

// outputOK rejects translations that look hijacked. Output may not be empty/absurdly long,
// contain control/format chars, or introduce URLs absent from the source.
func outputOK(src, out string) bool {
	if strings.TrimSpace(out) == "" {
		return false
	}
	if !utf8.ValidString(out) || utf8.RuneCountInString(out) > 3*utf8.RuneCountInString(src)+60 {
		return false
	}
	for _, r := range out {
		if isBad(r) && r != '\n' && r != '\t' {
			return false
		}
	}
	for _, u := range urlRe.FindAllString(out, -1) {
		if !strings.Contains(src, strings.TrimRight(u, ".,;:!?、。")) {
			return false
		}
	}
	return true
}

// parseJSONArray is strict: the whole output must be a JSON array of strings (a code fence is
// tolerated). No "find an array somewhere in the prose" fallback - that would accept hijacked output.
func parseJSONArray(s string) ([]string, bool) {
	s = fenceRe.ReplaceAllString(strings.TrimSpace(s), "")
	var v []any
	if err := json.Unmarshal([]byte(s), &v); err != nil || v == nil {
		return nil, false
	}
	out := make([]string, len(v))
	for i, x := range v {
		str, ok := x.(string)
		if !ok {
			return nil, false
		}
		out[i] = str
	}
	return out, true
}
