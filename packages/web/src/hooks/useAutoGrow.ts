import { useLayoutEffect, type RefObject } from 'react';

/**
 * textareaを内容に合わせて自動で伸ばす。
 *
 * CSSの min-height / max-height を尊重する。max-height に達したら
 * 内部スクロール（overflow-y: auto）へ切り替え、以降のキャレット追従は
 * ブラウザ標準挙動に任せる（GitHubのコメント欄や autosize 系ライブラリと同方式）。
 * 伸びている途中でも、フォーカス中はキャレットのある下端が
 * ビューポート外へ押し出されないようスクロールで追従させる。
 *
 * 再マウント時の高さのちらつきを避けるため useLayoutEffect を使う。
 *
 * @param ref - textarea要素へのref
 * @param value - textareaの現在値（変更時に再計算）
 * @param trigger - 追加の再計算トリガー（例: タブモード）
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  trigger?: unknown
): void {
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    const previousHeight = textarea.style.height;

    // scrollHeight は border を含まないため、border-box では上下の border 幅を加算する
    const computed = window.getComputedStyle(textarea);
    const borders =
      (parseFloat(computed.borderTopWidth) || 0) +
      (parseFloat(computed.borderBottomWidth) || 0);

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + borders}px`;

    // max-height でクランプされた場合のみ内部スクロールを有効にする
    const isClamped = textarea.scrollHeight - textarea.clientHeight > 1;
    textarea.style.overflowY = isClamped ? 'auto' : 'hidden';

    // JSによる高さ変更ではブラウザがキャレットを追従スクロールしないため、
    // 入力中（フォーカス中）に高さが変わったら要素全体を可視域に保つ
    if (
      document.activeElement === textarea &&
      textarea.style.height !== previousHeight
    ) {
      textarea.scrollIntoView({ block: 'nearest' });
    }
  }, [ref, value, trigger]);
}
