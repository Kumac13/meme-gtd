/**
 * ヘッダー、Issue 系ページ、Projects が共有する外枠の横幅。
 * sm 以上で画面幅の8割。8割が従来の枠（max-w-7xl = 80rem）を下回る画面幅では従来の枠を保つ。
 * ヘッダーと本文の左右の端を揃えるため、枠の幅はこの指定だけを使う。
 */
export const FRAME_WIDTH = 'sm:max-w-none sm:w-[80vw] sm:min-w-[min(100%,80rem)]';

/** ページの外枠。狭幅では従来どおり左右に余白を取り、sm 以上は枠いっぱいに置く。 */
export const WIDE_PAGE_WIDTH = `max-w-4xl px-4 sm:px-0 ${FRAME_WIDTH}`;
