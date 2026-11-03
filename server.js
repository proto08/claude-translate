#!/usr/bin/env node
// claude -p を OpenAI互換API (/v1/chat/completions) として公開するローカルサーバー。
// 依存パッケージなし。Claude Code にログイン済み(サブスク枠)であればそのまま動く。
//
// 使い方: node server.js
// 環境変数: PORT(8787) MODEL(haiku) CONCURRENCY(3) CLAUDE_BIN(claude) TIMEOUT_MS(120000)

const http = require("http");
const os = require("os");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.MODEL || "haiku";
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 120000);

let running = 0;
const queue = [];
function acquire() {
  return new Promise((resolve) => {
    if (running < CONCURRENCY) { running++; resolve(); }
    else queue.push(resolve);
  });
}
function release() {
  const next = queue.shift();
  if (next) next(); else running--;
}

function runClaude(system, prompt, model) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--model", model, "--tools", "", "--no-session-persistence"];
    if (system) args.push("--system-prompt", system);
    // 空ディレクトリで実行し、CLAUDE.md 等を拾わないようにする
    const child = spawn(CLAUDE_BIN, args, { cwd: os.tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("timeout")); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`));
    });
    child.stdin.end(prompt);
  });
}

function contentToText(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : p.text || "")).join("");
  return "";
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  // 通常のWebページからの呼び出しを拒否(拡張機能とcurlのみ許可)
  const origin = req.headers.origin;
  if (origin && !origin.startsWith("moz-extension://") && !origin.startsWith("chrome-extension://")) {
    return send(res, 403, { error: "forbidden origin" });
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    });
    return res.end();
  }
  if (req.method === "GET" && (req.url === "/health" || req.url === "/v1/models")) {
    return send(res, 200, { ok: true, data: [{ id: MODEL, object: "model" }] });
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    return send(res, 404, { error: "not found" });
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2_000_000) return send(res, 413, { error: "too large" });
  }
  let json;
  try { json = JSON.parse(body); } catch { return send(res, 400, { error: "bad json" }); }

  const messages = Array.isArray(json.messages) ? json.messages : [];
  const system = messages.filter((m) => m.role === "system").map((m) => contentToText(m.content)).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const prompt = rest.length === 1
    ? contentToText(rest[0].content)
    : rest.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${contentToText(m.content)}`).join("\n\n");

  // 任意のモデル名を許可しない: haiku/sonnet/opus 系のみ指定可、それ以外は既定値
  const reqModel = /^(haiku|sonnet|opus|claude-[\w.-]+)$/.test(json.model || "") ? json.model : MODEL;

  await acquire();
  try {
    const text = await runClaude(system, prompt, reqModel);
    send(res, 200, {
      id: "chatcmpl-" + Date.now(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: reqModel,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    });
  } catch (e) {
    console.error("[error]", e.message);
    send(res, 500, { error: { message: e.message } });
  } finally {
    release();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`claude-translate server: http://127.0.0.1:${PORT}  (model=${MODEL}, concurrency=${CONCURRENCY})`);
});
