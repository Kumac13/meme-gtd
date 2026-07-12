import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TemplatesService } from '../../api/services/TemplatesService';
import SearchInput from '../../components/SearchInput';
import FilterBar from '../../components/FilterBar';
import ItemList from '../../components/ItemList';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';

interface TemplateItem {
  id: number;
  type: 'template';
  title: string | null;
  bodyMd: string;
  templateTarget: 'task' | 'article';
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 20;

export default function TemplatesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = searchParams.get('q') || '';
  const rawTarget = searchParams.get('target');
  const targetFilter = rawTarget === 'task' || rawTarget === 'article' ? rawTarget : 'all';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const offset = (currentPage - 1) * PAGE_SIZE;
        const res = await TemplatesService.listTemplates(
          PAGE_SIZE,
          offset,
          searchQuery || undefined,
          targetFilter === 'all' ? undefined : targetFilter
        );
        setItems((res?.data ?? []) as TemplateItem[]);
        setTotal(res?.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchQuery, targetFilter, currentPage]);

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams);
      if (page === 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams]
  );

  const handleTargetChange = (target: string) => {
    const params = new URLSearchParams(searchParams);
    if (target === 'all') {
      params.delete('target');
    } else {
      params.set('target', target);
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleDelete = async (id: number) => {
    await TemplatesService.deleteTemplate(String(id));
    setItems((prev) => prev.filter((t) => t.id !== id));
    setTotal((prev) => prev - 1);
  };

  if (loading) return <LoadingState message="Loading templates..." />;
  if (error) return <ErrorState error={error} title="Error loading templates" />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-4">
        <SearchInput value={searchQuery} onChange={handleSearchChange} placeholder="Search templates" />
      </div>

      <FilterBar
        showStatusFilter
        statusFilter={targetFilter}
        onStatusFilterChange={handleTargetChange}
        statusOptions={['all', 'task', 'article']}
        statusLabels={{ task: 'Task', article: 'Article' }}
        showBookmarkFilter={false}
      />

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">
          {total} {total === 1 ? 'template' : 'templates'}
        </div>
        <Link
          to="/templates/new"
          className="px-3 py-2 bg-github-green-600 text-white rounded-md text-sm font-medium hover:bg-github-green-700"
        >
          New Template
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          message={searchQuery ? 'No templates match your search' : 'No templates yet'}
          submessage={
            searchQuery
              ? 'Try a different keyword'
              : 'Create a template to reuse a body, labels and projects when making tasks or articles'
          }
        />
      ) : (
        <>
          <ItemList
            items={items}
            itemType="template"
            basePath="/templates"
            currentFilters={searchParams}
            onDelete={handleDelete}
          />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
