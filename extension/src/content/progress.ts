// Progress badge shown at the bottom-right of the page. Pure UI: knows nothing about translation.
import { UI_ATTR } from "./constants";

export interface Progress {
  /** ratio (0..1) shows a progress bar; error tints the badge red. */
  show(msg: string, ratio?: number | null, error?: boolean): void;
  hide(): void;
}

export function createProgress(): Progress {
  let badge: HTMLDivElement | null = null;
  let text: HTMLDivElement;
  let track: HTMLDivElement;
  let bar: HTMLDivElement;

  function build(): HTMLDivElement {
    const el = document.createElement("div");
    el.setAttribute(UI_ATTR, "");
    el.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;min-width:160px;max-width:280px;" +
      "color:#fff;font:13px/1.4 system-ui,sans-serif;padding:10px 14px 12px;border-radius:10px;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:none";
    text = document.createElement("div");
    track = document.createElement("div");
    track.style.cssText = "height:4px;margin-top:8px;border-radius:2px;background:rgba(255,255,255,.25);overflow:hidden";
    bar = document.createElement("div");
    bar.style.cssText = "height:100%;width:0;background:#fff;transition:width .25s";
    track.appendChild(bar);
    el.append(text, track);
    document.documentElement.appendChild(el);
    return el;
  }

  return {
    show(msg, ratio, error) {
      if (!msg) return this.hide();
      badge ??= build();
      badge.style.background = error ? "#b3261e" : "#2b2b2f";
      text.textContent = msg;
      track.style.display = ratio == null ? "none" : "";
      if (ratio != null) bar.style.width = `${Math.round(ratio * 100)}%`;
    },
    hide() {
      badge?.remove();
      badge = null;
    },
  };
}
