# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Firefox extension (MV3) that translates English web pages to Japanese by calling a local server, which shells out to `claude -p` (uses the user's Claude Code login, no API key). README.md (Japanese) documents usage and the security model. No tests.

- Extension: TypeScript in `extension/src/`, managed with **bun**, bundled to `extension/dist/` (gitignored; Firefox loads that output).
- Server: Python package in `server/claude_translate/`, managed with **uv**, stdlib only (no runtime dependencies).

## Commands

- Run server: `cd server && uv run claude-translate [--model opus] [--port N]` (default model `haiku`, port 8787)
- Print auth token: `cd server && uv run claude-translate --show-token` (stored at `~/.config/claude-translate/token`, mode 0600)
- Build extension: `bun install` once, then `bun run build` (`bun run watch` to rebuild on change, `bun run typecheck` for tsc only). Never edit `extension/dist/`.
- Lint/format: extension uses **oxlint** + **oxfmt** (`bun run lint`, `bun run fmt` / `fmt:check`, `bun run check` for lint+fmt+typecheck); server uses **ruff** (`cd server && uv run ruff check . && uv run ruff format .`).
- Git hooks: **lefthook** (`lefthook.yml`) runs these checks on staged files before each commit (installed by `bun install` via the `prepare` script). CI (`.github/workflows/ci.yml`) runs the same checks; Dependabot (`.github/dependabot.yml`) updates actions, bun and uv deps weekly: minor/patch PRs are auto-merged by the `automerge` job in `ci.yml` after CI passes; major updates stay as open PRs for manual review.
- Minimum release age (supply chain): only package versions published ≥3 days ago are installed. bun: `minimumReleaseAge = 259200` (seconds) in `bunfig.toml`; uv: `exclude-newer = "3 days"` under `[tool.uv]` in `server/pyproject.toml` (`uv.lock` records `exclude-newer-span = "P3D"`); Dependabot `cooldown.default-days: 3` for bun/uv matches. To install a newer package urgently, use `minimumReleaseAgeExcludes` (bun) or `exclude-newer-package` (uv) for that package only.
- Actions pinning: workflow `uses:` are pinned to commit SHAs via `.github/workflows/actions.lock` (`github/gh-actions-lock`). After adding/changing any `uses:` run `gh actions-lock` and commit the lockfile; write full version tags (`@v4.4.0`, not `@v4`). CI runs `gh actions-lock --verify`, lefthook runs `--verify-local`. Container images are not locked by the tool: pin any image with `@sha256:`.
- Load extension: Firefox `about:debugging#/runtime/this-firefox` → load temporary add-on → `extension/manifest.json`; paste the token in the popup. Reload the add-on after each build.
- Changing the port requires editing both `extension/manifest.json` (`host_permissions`) and `ENDPOINT` in `extension/src/background/server-client.ts`.

## Architecture

Flow: popup → injects `dist/content.js` on demand via `activeTab`/`scripting` → content script collects visible text blocks, batches them, sends `{type:"translate", texts}` to the background → background `fetch`es `POST http://127.0.0.1:8787/translate` with the bearer token → server runs `claude -p` and returns `{translations: [string|null]}` (null = leave original untouched).

Logic and UI are kept in separate modules on both sides:

- `extension/src/shared/`: message types (`messages.ts`) and typed storage access (`settings.ts`).
- `extension/src/background/`: `server-client.ts` is the only code that reads the token or talks to the server (the content script never sees it); `index.ts` only routes messages.
- `extension/src/content/` — logic: `collect.ts` (what to translate; visibility/chrome filters), `batch.ts`, `session.ts` (run orchestration), `apply.ts` (DOM writes/undo). UI: `progress.ts` (badge). `index.ts` wires them.
- `extension/src/popup/` — logic: `actions.ts` (storage + sending commands); UI: `view.ts` (DOM only); `index.ts` glues; markup/styles in `popup.html` / `popup.css`.
- `server/claude_translate/`: `config` (limits, token file), `sanitize` (input sanitizing, output validation, strict JSON parse), `claude` (subprocess + prompt), `translator` (cache, validation, retry), `handler` (HTTP guard), `cli`.
- Server validates Host/Origin (`moz-extension://` only) + bearer token, caps request size, sanitizes input, runs `claude` with tools/MCP/slash commands disabled in an empty temp dir with a minimal env, and strictly parses a JSON array of strings back. Bad batch → split in halves recursively; output failing `output_ok` → retried alone, then left untranslated. Results are cached in memory keyed by model+text.
- Prompt-injection defense is layered across both sides: the content script filters invisible text (`isVisible` in `collect.ts`) before sending; the server strips invisible Unicode (`sanitize.py`), wraps text in a nonce-delimited untrusted block, and validates output. Keep these layers in sync when changing either side.

## Gotchas

- Entry points are bundled as IIFE classic scripts (`scripts/build.ts`) because `dist/content.js` is injected via `executeScript` and `dist/popup.js` is loaded by a plain `<script>`; paths in `manifest.json`, `popup.html` and `popup.ts` (`dist/content.js`) must match the build output names.
- `/server.js` at the repo root is a separate, unrelated Node script exposing `claude -p` as an OpenAI-compatible `/v1/chat/completions` endpoint (env-var config, default model haiku, same port 8787). It is not used by the extension and lacks the token/origin/injection protections of `server/claude_translate`; don't confuse the two.
- Content-script limits (`BATCH_CHARS`, `BATCH_ITEMS` in `extension/src/content/batch.ts`) must stay under the server caps `MAX_ITEMS` / `MAX_CHARS` / `MAX_BODY` in `server/claude_translate/config.py`.
- Replace mode (`apply.ts`) sets text via `textContent` (inline markup is lost; original HTML is kept for undo). Never switch to `innerHTML` for translated text.
