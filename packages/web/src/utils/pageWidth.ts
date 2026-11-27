/**
 * Issue 系ページ（一覧・詳細・作成・編集・Links）の外枠の横幅。
 * sm 以上で画面幅の8割まで広げ、狭幅では従来どおり左右に余白を取る。
 * 親の `main` が上限を外している経路（Layout の Issue 系ルート）で使う。
 * 8割が従来の幅を下回る画面幅では従来の幅（min-w）を保ち、狭くならないようにする。
 */
const WIDE_BASE = 'max-w-4xl px-4 sm:max-w-none sm:w-[80vw] sm:px-0';

/** 一覧・作成・編集・Links 用。従来の max-w-4xl（56rem）を下回らない。 */
export const WIDE_PAGE_WIDTH = `${WIDE_BASE} sm:min-w-[min(100%,56rem)]`;

/** 詳細用。従来の max-w-7xl（80rem）を下回らない。 */
export const WIDE_DETAIL_WIDTH = `${WIDE_BASE} sm:min-w-[min(100%,80rem)]`;
