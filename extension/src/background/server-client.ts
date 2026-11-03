import type { TranslateResponse } from "../shared/messages";
import { getSettings } from "../shared/settings";

// Changing the port also requires editing host_permissions in manifest.json.
const ENDPOINT = "http://127.0.0.1:8787/translate";

/** The only place that reads the token or talks to the local server. */
export async function requestTranslation(texts: string[]): Promise<TranslateResponse> {
  const { token } = await getSettings();
  if (!token) return { error: "トークン未設定（ポップアップで入力）" };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ texts }),
    });
    const data: { error?: string; translations?: (string | null)[] } = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
    return { translations: data.translations };
  } catch {
    return { error: "サーバーに接続できません（server を起動していますか？）" };
  }
}
