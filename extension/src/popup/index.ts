import { loadState, runCommand, saveMode, saveToken } from "./actions";
import { view } from "./view";

void (async () => {
  const { hasToken, bilingual } = await loadState();
  view.setBilingual(bilingual);
  view.showTokenState(hasToken);
  if (!hasToken) {
    view.openSettings();
    view.setStatus("最初にトークンを設定してください", "err");
  }
})();

view.onModeChange(() => void saveMode(view.getBilingual()));

view.onSaveToken(async () => {
  const token = view.getTokenInput();
  if (!token) return view.setStatus("トークンを入力してください", "err");
  await saveToken(token);
  view.clearTokenInput();
  view.showTokenState(true);
  view.setStatus("保存しました", "ok");
});

view.onTranslate(async () => {
  const ok = await runCommand({ type: "start", bilingual: view.getBilingual() });
  if (ok) view.setStatus("翻訳を開始しました（進捗はページ右下）", "ok");
  else view.setStatus("このページでは実行できません", "err");
});

view.onRestore(async () => {
  const ok = await runCommand({ type: "restore" });
  if (ok) view.setStatus("元に戻しました", "ok");
  else view.setStatus("このページでは実行できません", "err");
});
