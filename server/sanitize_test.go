package main

import (
	"strings"
	"testing"
)

func TestSanitizeInput(t *testing.T) {
	// zero-width space, bidi override, Unicode tag char, control char, whitespace runs
	in := "He​llo‮  wor\U000E0041ld\x07 \n  !"
	if got, want := sanitizeInput(in), "Hello world !"; got != want {
		t.Errorf("got %q want %q", got, want)
	}
}

func TestOutputOK(t *testing.T) {
	cases := []struct {
		src, out string
		ok       bool
	}{
		{"Hello", "こんにちは", true},
		{"Hello", "  ", false},
		{"Hello", "こん​にちは", false},
		{"See docs", "https://evil.example を見て", false},
		{"See https://a.example/x.", "https://a.example/x を参照。", true},
		{"Hi", strings.Repeat("あ", 100), false},
	}
	for _, c := range cases {
		if got := outputOK(c.src, c.out); got != c.ok {
			t.Errorf("outputOK(%q,%q)=%v want %v", c.src, c.out, got, c.ok)
		}
	}
}

func TestParseJSONArray(t *testing.T) {
	good := map[string]int{`["a","b"]`: 2, "```json\n[\"a\"]\n```": 1, `[]`: 0}
	for s, n := range good {
		if v, ok := parseJSONArray(s); !ok || len(v) != n {
			t.Errorf("%q: %v %v", s, v, ok)
		}
	}
	for _, s := range []string{`null`, `["a", null]`, `[1]`, `Sure! ["a"]`, `{"a":1}`, ``} {
		if _, ok := parseJSONArray(s); ok {
			t.Errorf("%q should be rejected", s)
		}
	}
}

func TestParseRequest(t *testing.T) {
	if _, ok := parseRequest([]byte(`{"texts":["a","b"]}`)); !ok {
		t.Error("valid rejected")
	}
	for _, s := range []string{`{"texts":[]}`, `{"texts":["a",null]}`, `{"texts":"a"}`, `{}`, `x`} {
		if _, ok := parseRequest([]byte(s)); ok {
			t.Errorf("%q should be rejected", s)
		}
	}
}
