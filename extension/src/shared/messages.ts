// Message and storage types shared by the popup, background and content scripts.

export interface TranslateRequest {
  type: "translate";
  texts: string[];
}

/** `null` entries mean "leave the original text untouched". */
export interface TranslateResponse {
  translations?: (string | null)[];
  error?: string;
}

export type ContentCommand = { type: "start"; bilingual: boolean } | { type: "restore" };

export interface Settings {
  token?: string;
  bilingual?: boolean;
}
