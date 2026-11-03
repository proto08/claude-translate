// Decides WHICH text on the page gets translated (pure DOM reading, no mutation, no UI).
// The visibility filter is the first layer of prompt-injection defence: hidden text is never sent.
// Keep in sync with server-side sanitization (server/claude_translate/sanitize.py).
import { MARK, UI_ATTR } from "./constants";
import type { Item } from "./types";

const BLOCK = "p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,dt,dd,summary,caption,div";
const SKIP = `script,style,noscript,code,pre,textarea,input,select,svg,math,[contenteditable],[translate=no],.notranslate,[${UI_ATTR}]`;
// Page chrome (site header/footer, navigation, sidebars) is not translated; only the main content is.
const CHROME =
  "nav,aside,footer,[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[role=search]";
const CONTENT = "main,[role=main],article";

const hasJa = (s: string) => /[぀-ヿ一-鿿]/.test(s);
const hasLatin = (s: string) => /[A-Za-z]{2,}/.test(s);

// Only text a human can actually see: skips display:none, visibility:hidden, aria-hidden,
// opacity:0, ~0px fonts, clipped/zero-size boxes and text pushed far off-screen.
function isVisible(el: HTMLElement): boolean {
  if (el.closest("[aria-hidden='true'],[hidden]")) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.1) return false;
  if (parseFloat(cs.fontSize) < 4) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const x = r.right + window.scrollX,
    y = r.bottom + window.scrollY;
  if (x < 0 || y < 0 || r.left + window.scrollX > document.documentElement.scrollWidth + 50) return false;
  // text colour equal to background colour (white-on-white) is also hidden text
  if (cs.color === cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") return false;
  return true;
}

// Prefer <main>; else all top-level <article>s; else fall back to the whole body.
function contentRoots(): HTMLElement[] {
  const main = document.querySelector<HTMLElement>("main,[role=main]");
  if (main) return [main];
  const articles = [...document.querySelectorAll<HTMLElement>("article")].filter(
    (a) => !a.parentElement?.closest("article"),
  );
  return articles.length ? articles : [document.body];
}

function isChrome(el: HTMLElement): boolean {
  if (el.closest(CHROME)) return true;
  // <header> is page chrome unless it is the heading block of an article/main
  const h = el.closest("header");
  return !!h && !h.parentElement?.closest(CONTENT);
}

/** A block is translatable if it has direct text and no nested block candidate. */
export function collect(): Item[] {
  const out: Item[] = [];
  const seen = new Set<Element>();
  const nodes = contentRoots().flatMap((r) => [...r.querySelectorAll<HTMLElement>(BLOCK)]);
  for (const el of nodes) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (el.hasAttribute(MARK) || el.closest(SKIP) || isChrome(el)) continue;
    if (el.querySelector(BLOCK)) continue; // only innermost blocks
    const text = el.innerText?.replace(/\s+/g, " ").trim();
    if (!text || text.length < 2 || !hasLatin(text) || hasJa(text)) continue;
    if (!isVisible(el)) continue; // never send hidden text (common injection hiding spot)
    out.push({ el, text });
  }
  return out;
}
