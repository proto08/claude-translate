# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chromium extension (MV3, Chrome/Edge/Brave etc.) that translates English web pages to Japanese by calling a local server, which shells out to `claude -p` (uses the user's Claude Code login, no API key). README.md (Japanese) documents usage and the security model. Only the Go server's sanitizer/request parsing has unit tests (`go test ./...`).

- Extension: TypeScript in `extension/src/`, managed with **bun**, bundled to `extension/dist/` (gitignored; the browser loads that output).
- Server: Go module in `server/` (package `main`, one file per concern), standard library only (no runtime dependencies).

## Commands

- Run server: `cd server && go run . [--model opus] [--port N]` (or `go build -o claude-translate .`; default model `haiku`, port 8787)
- Print auth token: `cd server && go run . --show-token` (stored at `~/.config/claude-translate/token`, mode 0600)
- Build extension: `bun install` once, then `bun run build` (`bun run watch` to rebuild on change, `bun run typecheck` for tsc only). Never edit `extension/dist/`.
- Lint/format: extension uses **oxlint** + **oxfmt** (`bun run lint`, `bun run fmt` / `fmt:check`, `bun run check` for lint+fmt+typecheck); server uses `gofmt` / `go vet` / `go test ./...` (run in `server/`).
- Git hooks: **lefthook** (`lefthook.yml`) runs these checks on staged files before each commit (installed by `bun install` via the `prepare` script). CI (`.github/workflows/ci.yml`) runs the same checks; Dependabot (`.github/dependabot.yml`) updates actions and bun deps weekly: minor/patch PRs are auto-merged by the `automerge` job in `ci.yml` after CI passes; major updates stay as open PRs for manual review.
- Minimum release age (supply chain): only package versions published ≥3 days ago are installed. bun: `minimumReleaseAge = 259200` (seconds) in `bunfig.toml`; Dependabot `cooldown.default-days: 3` matches. The Go server has no third-party dependencies (keep it that way). To install a newer package urgently, use `minimumReleaseAgeExcludes` (bun) for that package only.
- Actions pinning: workflow `uses:` are pinned to commit SHAs via `.github/workflows/actions.lock` (`github/gh-actions-lock`). After adding/changing any `uses:` run `gh actions-lock` and commit the lockfile; write full version tags (`@v4.4.0`, not `@v4`). CI runs `gh actions-lock --verify`, lefthook runs `--verify-local`. Container images are not locked by the tool: pin any image with `@sha256:`.
- Load extension: `chrome://extensions` → enable Developer mode → Load unpacked → select `extension/`; paste the token in the popup. Click the reload icon on the extension card after each build.
- Changing the port requires editing both `extension/manifest.json` (`host_permissions`) and `ENDPOINT` in `extension/src/background/server-client.ts`.

## Architecture

Flow: popup → injects `dist/content.js` on demand via `activeTab`/`scripting` → content script collects visible text blocks, batches them, sends `{type:"translate", texts}` to the background → background `fetch`es `POST http://127.0.0.1:8787/translate` with the bearer token → server runs `claude -p` and returns `{translations: [string|null]}` (null = leave original untouched).

Logic and UI are kept in separate modules on both sides:

- `extension/src/shared/`: message types (`messages.ts`) and typed storage access (`settings.ts`).
- `extension/src/background/`: `server-client.ts` is the only code that reads the token or talks to the server (the content script never sees it); `index.ts` only routes messages.
- `extension/src/content/` — logic: `collect.ts` (what to translate; visibility/chrome filters), `batch.ts`, `session.ts` (run orchestration), `apply.ts` (DOM writes/undo). UI: `progress.ts` (badge). `index.ts` wires them.
- `extension/src/popup/` — logic: `actions.ts` (storage + sending commands); UI: `view.ts` (DOM only); `index.ts` glues; markup/styles in `popup.html` / `popup.css`.
- `server/*.go`: `config` (limits, token file), `sanitize` (input sanitizing, output validation, strict JSON parse; has unit tests), `claude` (subprocess + prompt), `translator` (cache, validation, retry), `handler` (HTTP guard), `main` (flags, startup).
- Server validates Host/Origin (`chrome-extension://` only) + bearer token, caps request size, sanitizes input, runs `claude` with tools/MCP/slash commands disabled in an empty temp dir with a minimal env, and strictly parses a JSON array of strings back. Bad batch → split in halves recursively; output failing `outputOK` → retried alone, then left untranslated. Results are cached in memory keyed by model+text.
- Prompt-injection defense is layered across both sides: the content script filters invisible text (`isVisible` in `collect.ts`) before sending; the server strips invisible Unicode (`sanitize.go`), wraps text in a nonce-delimited untrusted block, and validates output. Keep these layers in sync when changing either side.

## Gotchas

- The background is an MV3 service worker (`dist/background.js`). Its `onMessage` listener must answer via `sendResponse` and `return true`: Chrome ignores a returned Promise (Firefox didn't). APIs are called through the `chrome.*` namespace (promise-based in MV3).
- Entry points are bundled as IIFE classic scripts (`scripts/build.ts`) because `dist/content.js` is injected via `executeScript` and `dist/popup.js` is loaded by a plain `<script>`; paths in `manifest.json`, `popup.html` and `popup.ts` (`dist/content.js`) must match the build output names.
- `/server.js` at the repo root is a separate, unrelated Node script exposing `claude -p` as an OpenAI-compatible `/v1/chat/completions` endpoint (env-var config, default model haiku, same port 8787). It is not used by the extension and lacks the token/origin/injection protections of `server/`; don't confuse the two.
- Content-script limits (`BATCH_CHARS`, `BATCH_ITEMS` in `extension/src/content/batch.ts`) must stay under the server caps `maxItems` / `maxChars` / `maxBody` in `server/config.go`.
- Replace mode (`apply.ts`) sets text via `textContent` (inline markup is lost; original HTML is kept for undo). Never switch to `innerHTML` for translated text.
