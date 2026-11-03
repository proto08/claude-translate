# Claude Translate (local)

英語ページを Claude（既定: haiku）で日本語に置換。Claude Code のログインをそのまま使う（APIキー不要）。

## 使い方
1. `claude` にログイン済みであること（`claude` を一度起動して認証）。
2. サーバー起動: `cd server && uv run claude-translate`（`--model opus` などで変更可、`--port` 変更時は
   `extension/manifest.json` と `extension/src/background/server-client.ts` の 8787 も合わせる）
3. 拡張のビルド: `bun install && bun run build`（`extension/src/` → `extension/dist/`）
4. トークン表示: `cd server && uv run claude-translate --show-token`
5. Firefox で `about:debugging#/runtime/this-firefox` → 一時的なアドオンを読み込む → `extension/manifest.json`
6. 拡張アイコン → 設定にトークンを貼って保存 → 「このページを翻訳」
   「原文の下に日本語を表示」にチェックで原文の直下に訳文を表示。
