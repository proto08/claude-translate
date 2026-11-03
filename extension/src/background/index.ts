import { requestTranslation } from "./server-client";

browser.runtime.onMessage.addListener((msg: { type?: string; texts?: unknown }, sender) => {
  // Accept messages only from our own extension pages / content scripts.
  if (sender.id !== browser.runtime.id) return;
  if (msg?.type !== "translate") return;
  const { texts } = msg;
  if (!Array.isArray(texts) || !texts.every((t) => typeof t === "string")) {
    return Promise.resolve({ error: "bad input" });
  }
  return requestTranslation(texts);
});
