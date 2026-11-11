package main

// Translation policy on top of runClaude: sanitize, cache, validate, retry suspicious items alone.

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"sync"
)

var (
	cache   = map[[32]byte]string{}
	cacheMu sync.Mutex
)

func cacheKey(model, text string) [32]byte {
	return sha256.Sum256([]byte(model + "\x00" + text))
}

func shorten(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		r = r[:n]
	}
	return string(r)
}

// translate returns one entry per input; nil = untranslated (client leaves the original text).
func translate(ctx context.Context, texts []string, model string) ([]*string, error) {
	clean := make([]string, len(texts))
	keys := make([][32]byte, len(texts))
	result := make([]*string, len(texts))
	var todo []int
	cacheMu.Lock()
	for i, t := range texts {
		clean[i] = sanitizeInput(t)
		keys[i] = cacheKey(model, clean[i])
		if v, ok := cache[keys[i]]; ok {
			result[i] = &v
		} else if clean[i] != "" {
			todo = append(todo, i)
		}
	}
	cacheMu.Unlock()
	if len(todo) == 0 {
		return result, nil
	}

	batch := make([]string, len(todo))
	for j, i := range todo {
		batch[j] = clean[i]
	}
	out, err := runClaude(ctx, batch, model)
	if err != nil {
		return nil, err
	}
	good := map[int]string{}
	var bad []int
	for j, i := range todo {
		if outputOK(clean[i], out[j]) {
			good[i] = out[j]
		} else {
			bad = append(bad, i)
		}
	}
	// A suspicious item may have been steered by a neighbour in the same batch:
	// retry each alone (no other page text in context); still bad -> leave untranslated.
	for _, i := range bad {
		log.Printf("[warn] output rejected, retrying alone: %s", fmt.Sprintf("%q", shorten(clean[i], 60)))
		if o, err := runClaude(ctx, []string{clean[i]}, model); err == nil && outputOK(clean[i], o[0]) {
			good[i] = o[0]
		}
	}
	cacheMu.Lock()
	defer cacheMu.Unlock()
	if len(cache) > cacheMaxEntries {
		clear(cache)
	}
	for i, o := range good {
		result[i] = &o
		cache[keys[i]] = o
	}
	return result, nil
}
