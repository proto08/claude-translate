// Injected on demand (activeTab). Idempotent: re-injection is a no-op.
import type { ContentCommand } from "../shared/messages";
import { createProgress } from "./progress";
import { createSession } from "./session";

const w = window as Window & { claudeTranslateLoaded?: boolean };
if (!w.claudeTranslateLoaded) {
  w.claudeTranslateLoaded = true;
  const session = createSession(createProgress());
  browser.runtime.onMessage.addListener((msg: ContentCommand) => {
    if (msg?.type === "start") void session.start(!!msg.bilingual);
    else if (msg?.type === "restore") session.restore();
  });
}
