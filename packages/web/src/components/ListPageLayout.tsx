import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ListPageLayoutProps {
  search: ReactNode;
  createTo?: string;
  createLabel?: string;
  filters?: ReactNode;
  secondaryFilters?: ReactNode;
  summary?: ReactNode;
  empty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
  className?: string;
  /** sm 以上で画面幅の8割まで広げる（Links のグラフ用）。既定は他の一覧と同じ max-w-4xl。 */
  wide?: boolean;
}

/** Shared search/filter/result/pagination chrome for resource list pages. */
export function ListPageLayout({ search, createTo, createLabel, filters, secondaryFilters, summary, empty, emptyState, children, className = '', wide = false }: ListPageLayoutProps) {
  const width = wide ? 'max-w-4xl px-4 sm:max-w-none sm:w-[80vw] sm:px-0' : 'max-w-4xl px-4';
  return <div className={`${width} mx-auto py-2 ${className}`.trim()}>
    <div className="flex items-center gap-2 mb-4">
      {search}
      {createTo && createLabel && <Link to={createTo} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 whitespace-nowrap">{createLabel}</Link>}
    </div>
    {filters && <div className="mb-4 flex flex-wrap gap-2 items-center">{filters}</div>}
    {secondaryFilters}
    {summary && <div className="text-sm text-gray-500 mb-2">{summary}</div>}
    {empty ? emptyState : children}
  </div>;
}
