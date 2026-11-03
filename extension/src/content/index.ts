// Injected on demand (activeTab). Idempotent: re-injection is a no-op.
import type { ContentCommand } from "../shared/messages";
import { createProgress } from "./progress";
import { createSession } from "./session";

const w = window as Window & { __claudeTranslate?: boolean };
if (!w.__claudeTranslate) {
  w.__claudeTranslate = true;
  const session = createSession(createProgress());
  browser.runtime.onMessage.addListener((msg: ContentCommand) => {
    if (msg?.type === "start") void session.start(!!msg.bilingual);
    else if (msg?.type === "restore") session.restore();
  });
}
