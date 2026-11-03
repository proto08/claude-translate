import type { Settings } from "./messages";

export function getSettings(): Promise<Settings> {
  return browser.storage.local.get(["token", "bilingual"]) as Promise<Settings>;
}

export function saveSettings(patch: Settings): Promise<void> {
  return browser.storage.local.set(patch as Record<string, unknown>);
}
