// Popup DOM only: reads and writes elements, exposes events. No storage or messaging.
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

export type StatusKind = "" | "ok" | "err";

export const view = {
  setStatus(msg: string, kind: StatusKind = ""): void {
    $("status").textContent = msg;
    $("status").className = kind;
  },
  showTokenState(has: boolean): void {
    $("tokenState").textContent = has ? "トークン設定済み" : "トークン未設定";
    $("tokenState").className = has ? "ok" : "err";
  },
  openSettings(): void {
    $<HTMLDetailsElement>("settings").open = true;
  },
  getBilingual: (): boolean =>
    document.querySelector<HTMLInputElement>("input[name=mode]:checked")!.value === "bilingual",
  setBilingual(on: boolean): void {
    document.querySelector<HTMLInputElement>(
      `input[name=mode][value=${on ? "bilingual" : "replace"}]`,
    )!.checked = true;
  },
  getTokenInput: (): string => $<HTMLInputElement>("token").value.trim(),
  clearTokenInput(): void {
    $<HTMLInputElement>("token").value = "";
  },
  onTranslate: (fn: () => void) => $("translate").addEventListener("click", fn),
  onRestore: (fn: () => void) => $("restore").addEventListener("click", fn),
  onSaveToken: (fn: () => void) => $("save").addEventListener("click", fn),
  onModeChange: (fn: () => void) =>
    document.querySelectorAll("input[name=mode]").forEach((r) => r.addEventListener("change", fn)),
};
