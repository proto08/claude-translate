package main

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Request caps. The extension's batch limits (extension/src/content/batch.ts) must stay under these.
const (
	maxBody         = 512 * 1024 // bytes per request
	maxItems        = 200        // texts per request
	maxChars        = 40_000     // total chars per request
	claudeTimeout   = 180 * time.Second
	maxClaudeProcs  = 3 // concurrent claude processes
	cacheMaxEntries = 20_000

	defaultPort  = 8787
	defaultModel = "haiku"
)

func tokenPath() (string, error) {
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, ".config")
	}
	return filepath.Join(base, "claude-translate", "token"), nil
}

// loadToken reads the bearer token, creating it (mode 0600) on first run.
func loadToken() (string, error) {
	p, err := tokenPath()
	if err != nil {
		return "", err
	}
	if b, err := os.ReadFile(p); err == nil {
		return strings.TrimSpace(string(b)), nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return "", err
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	tok := base64.RawURLEncoding.EncodeToString(raw)
	f, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := f.WriteString(tok); err != nil {
		return "", err
	}
	return tok, nil
}
