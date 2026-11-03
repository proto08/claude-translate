export interface Item {
  el: HTMLElement;
  text: string;
  /** innerHTML before replacement (replace mode), kept for undo. */
  original?: string;
  /** Element inserted in bilingual mode, removed on undo. */
  added?: HTMLElement;
}
