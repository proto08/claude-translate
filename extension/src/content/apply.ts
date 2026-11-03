// Writes translations into the page and undoes them. No decisions about what to translate.
// Translated text is ONLY ever set via textContent: model output is never parsed as HTML.
import { MARK, UI_ATTR } from "./constants";
import type { Item } from "./types";

const applied: Item[] = [];

const isCell = (el: HTMLElement) => el.tagName === "LI" || /^(TD|TH)$/.test(el.tagName);

export function applyTranslation(it: Item, ja: string, bilingual: boolean): void {
  const { el } = it;
  el.setAttribute(MARK, "1");
  if (bilingual) {
    const t = document.createElement(isCell(el) ? "div" : el.tagName);
    t.setAttribute(UI_ATTR, "tr");
    t.textContent = ja;
    t.style.cssText = "color:#0a5;margin-top:.25em;font-size:.95em";
    if (isCell(el)) el.appendChild(t);
    else el.insertAdjacentElement("afterend", t);
    it.added = t;
  } else {
    it.original = el.innerHTML; // inline markup is lost on replace; kept for undo
    el.textContent = ja;
  }
  applied.push(it);
}

export function restoreAll(): void {
  for (const it of applied.splice(0)) {
    if (it.added) it.added.remove();
    else if (it.original !== undefined) it.el.innerHTML = it.original;
    it.el.removeAttribute(MARK);
  }
}
