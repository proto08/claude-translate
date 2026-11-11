package main

// HTTP layer: Host/Origin/token guard, request validation, JSON responses.

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Chromium extensions send `Origin: chrome-extension://<id>`.
const originPrefix = "chrome-extension://"

type handler struct {
	token string
	port  int
	model string
}

func (h *handler) send(w http.ResponseWriter, r *http.Request, code int, obj any) {
	body, _ := json.Marshal(obj)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if origin := r.Header.Get("Origin"); strings.HasPrefix(origin, originPrefix) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	w.WriteHeader(code)
	w.Write(body)
}

func (h *handler) guard(w http.ResponseWriter, r *http.Request) bool {
	p := strconv.Itoa(h.port)
	if r.Host != "127.0.0.1:"+p && r.Host != "localhost:"+p {
		h.send(w, r, http.StatusForbidden, map[string]string{"error": "bad host"})
		return false
	}
	if origin := r.Header.Get("Origin"); origin != "" && !strings.HasPrefix(origin, originPrefix) {
		h.send(w, r, http.StatusForbidden, map[string]string{"error": "bad origin"})
		return false
	}
	return true
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	switch r.Method {
	case http.MethodOptions:
		if origin := r.Header.Get("Origin"); strings.HasPrefix(origin, originPrefix) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		w.WriteHeader(http.StatusNoContent)
	case http.MethodPost:
		h.post(w, r)
	default:
		h.send(w, r, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *handler) post(w http.ResponseWriter, r *http.Request) {
	fail := func(code int, msg string) { h.send(w, r, code, map[string]string{"error": msg}) }
	if r.URL.Path != "/translate" {
		fail(http.StatusNotFound, "not found")
		return
	}
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+h.token)) != 1 {
		fail(http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.ContentLength <= 0 || r.ContentLength > maxBody {
		fail(http.StatusRequestEntityTooLarge, "bad size")
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		fail(http.StatusRequestEntityTooLarge, "bad size")
		return
	}
	texts, ok := parseRequest(raw)
	if !ok {
		fail(http.StatusBadRequest, "bad request")
		return
	}
	out, err := translate(r.Context(), texts, h.model)
	switch {
	case errors.Is(err, errTimeout):
		fail(http.StatusGatewayTimeout, "claude timed out")
	case err != nil:
		log.Printf("[error] %v", err)
		fail(http.StatusBadGateway, err.Error())
	default:
		h.send(w, r, http.StatusOK, map[string]any{"translations": out})
	}
}

// parseRequest accepts only {"texts": [string, ...]} within the item/char caps.
func parseRequest(raw []byte) ([]string, bool) {
	var req struct {
		Texts []any `json:"texts"`
	}
	if err := json.Unmarshal(raw, &req); err != nil || len(req.Texts) == 0 || len(req.Texts) > maxItems {
		return nil, false
	}
	texts := make([]string, len(req.Texts))
	chars := 0
	for i, x := range req.Texts {
		s, ok := x.(string)
		if !ok {
			return nil, false
		}
		texts[i] = s
		chars += utf8.RuneCountInString(s)
	}
	return texts, chars <= maxChars
}
