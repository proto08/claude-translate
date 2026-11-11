import type { Settings } from "./messages";

export function getSettings(): Promise<Settings> {
  return chrome.storage.local.get(["token", "bilingual"]) as Promise<Settings>;
}

export function saveSettings(patch: Settings): Promise<void> {
  return chrome.storage.local.set(patch as Record<string, unknown>);
}
