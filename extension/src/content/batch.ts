import type { Item } from "./types";

// Must stay under the server caps MAX_ITEMS / MAX_CHARS / MAX_BODY (server/claude_translate/config.py).
export const BATCH_CHARS = 3500;
export const BATCH_ITEMS = 40;

/** Items nearest the top of the viewport first, so what the user sees gets translated first. */
export function sortByViewport(list: Item[]): Item[] {
  const dist = (it: Item) => {
    const r = it.el.getBoundingClientRect();
    return r.bottom < 0 ? 1e6 + -r.bottom : Math.max(0, r.top);
  };
  return list.sort((a, b) => dist(a) - dist(b));
}

export function makeBatches(list: Item[]): Item[][] {
  const batches: Item[][] = [];
  let cur: Item[] = [], chars = 0;
  for (const it of list) {
    if (cur.length && (chars + it.text.length > BATCH_CHARS || cur.length >= BATCH_ITEMS)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += it.text.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
