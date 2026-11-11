# Claude Translate (local)

英語ページを Claude（既定: haiku）で日本語に置換。Claude Code のログインをそのまま使う（APIキー不要）。

## 使い方
1. `claude` にログイン済みであること（`claude` を一度起動して認証）。
2. サーバー起動: `cd server && go run .`（Go 1.25 以上。`go build -o claude-translate .` でバイナリ化も可。`--model opus` などで変更可、`--port` 変更時は
   `extension/manifest.json` と `extension/src/background/server-client.ts` の 8787 も合わせる）
3. 拡張のビルド: `bun install && bun run build`（`extension/src/` → `extension/dist/`）
4. トークン表示: `cd server && go run . --show-token`
5. Chromium 系ブラウザ（Chrome / Edge / Brave など、v116 以上）で `chrome://extensions` → デベロッパーモードを有効化 → 「パッケージ化されていない拡張機能を読み込む」→ `extension/` を選択（再ビルド後は拡張カードの更新ボタンを押す）
6. 拡張アイコン → 設定にトークンを貼って保存 → 「このページを翻訳」
   「原文の下に日本語を表示」にチェックで原文の直下に訳文を表示。
