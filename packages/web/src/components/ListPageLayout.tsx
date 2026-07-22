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
}

/** Shared search/filter/result/pagination chrome for resource list pages. */
export function ListPageLayout({ search, createTo, createLabel, filters, secondaryFilters, summary, empty, emptyState, children, className = '' }: ListPageLayoutProps) {
  return <div className={`max-w-4xl mx-auto px-4 py-2 ${className}`.trim()}>
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
