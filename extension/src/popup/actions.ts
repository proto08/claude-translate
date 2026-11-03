// Popup logic: settings persistence and sending commands to the active tab. No DOM access.
import type { ContentCommand } from "../shared/messages";
import { getSettings, saveSettings } from "../shared/settings";

export async function loadState(): Promise<{ hasToken: boolean; bilingual: boolean }> {
  const { token, bilingual } = await getSettings();
  return { hasToken: !!token, bilingual: !!bilingual };
}

export const saveMode = (bilingual: boolean) => saveSettings({ bilingual });
export const saveToken = (token: string) => saveSettings({ token });

/** Injects the content script into the active tab (activeTab grants access after the click) and sends a command. */
export async function runCommand(cmd: ContentCommand): Promise<boolean> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (tabId == null) return false;
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ["dist/content.js"] });
    await browser.tabs.sendMessage(tabId, cmd);
    return true;
  } catch {
    return false;
  }
}
