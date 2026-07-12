import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IoCheckboxOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { TemplatesService } from '../../api/services/TemplatesService';
import SearchInput from '../../components/SearchInput';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { LabelBadge } from '../../components/LabelBadge';

interface TemplateItem {
  id: number;
  title: string | null;
  templateTarget: 'task' | 'article';
  labels?: string[];
}

const PAGE_SIZE = 20;

export default function TemplatesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = searchParams.get('q') || '';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const offset = (currentPage - 1) * PAGE_SIZE;
        const res = await TemplatesService.listTemplates(PAGE_SIZE, offset, searchQuery || undefined);
        setItems((res?.data ?? []) as TemplateItem[]);
        setTotal(res?.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchQuery, currentPage]);

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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this template?')) return;
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
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            {items.map((t) => (
              <div key={t.id} className="relative">
                <Link to={`/templates/${t.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    {/* 種類（何を生むか）は行頭アイコンの形と色で示す — タグ（ピル）とは役割を分ける */}
                    <span
                      className="flex-shrink-0"
                      title={t.templateTarget === 'task' ? 'Creates a task' : 'Creates an article'}
                    >
                      {t.templateTarget === 'task' ? (
                        <IoCheckboxOutline className="w-5 h-5 text-github-green-600" aria-label="Creates a task" />
                      ) : (
                        <IoDocumentTextOutline className="w-5 h-5 text-blue-500" aria-label="Creates an article" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="text-base text-gray-900">{t.title || `Template #${t.id}`}</h2>
                        {t.labels?.slice(0, 3).map((l, i) => (
                          <LabelBadge key={i} name={l} />
                        ))}
                        {(t.labels?.length ?? 0) > 3 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                            +{(t.labels?.length ?? 0) - 3} more
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">#{t.id}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(t.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      aria-label="Delete template"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
