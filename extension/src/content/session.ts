// Orchestrates a translation run: collect -> batch -> request -> apply, reporting to the UI.
import type { TranslateRequest, TranslateResponse } from "../shared/messages";
import { applyTranslation, restoreAll } from "./apply";
import { makeBatches, sortByViewport } from "./batch";
import { collect } from "./collect";
import type { Progress } from "./progress";

const CONCURRENCY = 3;

export function createSession(ui: Progress) {
  let aborted = false;

  async function start(bilingual: boolean): Promise<void> {
    aborted = false;
    const list = sortByViewport(collect());
    if (!list.length) {
      ui.show("翻訳対象がありません");
      setTimeout(() => ui.hide(), 2000);
      return;
    }
    const batches = makeBatches(list);
    let done = 0,
      failed = 0,
      next = 0;
    ui.show(`翻訳中 0/${list.length}`, 0);

    async function worker(): Promise<void> {
      while (!aborted && next < batches.length) {
        const batch = batches[next++]!;
        const req: TranslateRequest = { type: "translate", texts: batch.map((b) => b.text) };
        const res: TranslateResponse | undefined = await chrome.runtime.sendMessage(req);
        if (aborted) return;
        if (res?.error || !res?.translations) {
          failed += batch.length;
          ui.show(`エラー: ${res?.error || "不明"}`, null, true);
          if (/トークン|接続|unauthorized/i.test(res?.error || "")) {
            aborted = true;
            return;
          }
        } else {
          const tr = res.translations;
          batch.forEach((it, i) => {
            const ja = tr[i];
            if (ja) applyTranslation(it, ja, bilingual);
          });
          done += batch.length;
          ui.show(`翻訳中 ${done}/${list.length}`, done / list.length);
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (!aborted) ui.show(failed ? `完了（${failed}件失敗）` : "完了", 1, !!failed);
    setTimeout(() => ui.hide(), 3000);
  }

  function restore(): void {
    aborted = true;
    restoreAll();
    ui.hide();
  }

  return { start, restore };
}
