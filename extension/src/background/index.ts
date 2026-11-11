import { requestTranslation } from "./server-client";

chrome.runtime.onMessage.addListener((msg: { type?: string; texts?: unknown }, sender, sendResponse) => {
  // Accept messages only from our own extension pages / content scripts.
  if (sender.id !== chrome.runtime.id) return;
  if (msg?.type !== "translate") return;
  const { texts } = msg;
  if (!Array.isArray(texts) || !texts.every((t) => typeof t === "string")) {
    sendResponse({ error: "bad input" });
    return;
  }
  void requestTranslation(texts).then(sendResponse);
  return true; // keep the channel open for the async response (Chrome ignores returned Promises)
});
