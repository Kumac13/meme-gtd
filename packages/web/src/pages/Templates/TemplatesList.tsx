import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TemplatesService } from '../../api/services/TemplatesService';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import { LabelBadge } from '../../components/LabelBadge';

interface TemplateItem {
  id: number;
  title: string | null;
  templateTarget: 'task' | 'article';
  labels?: string[];
}

export default function TemplatesList() {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await TemplatesService.listTemplates();
        setItems((res?.data ?? []) as TemplateItem[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this template?')) return;
    await TemplatesService.deleteTemplate(String(id));
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  if (loading) return <LoadingState message="Loading templates..." />;
  if (error) return <ErrorState error={error} title="Error loading templates" />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          {items.length} {items.length === 1 ? 'template' : 'templates'}
        </div>
        <Link to="/templates/new" className="px-3 py-2 bg-github-green-600 text-white rounded-md text-sm font-medium hover:bg-github-green-700">
          New Template
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          message="No templates yet"
          submessage="Create a template to reuse a body, labels and projects when making tasks or articles"
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {items.map((t) => (
            <div key={t.id} className="relative">
              <Link to={`/templates/${t.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-base text-gray-900">{t.title || `Template #${t.id}`}</h2>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
                        → {t.templateTarget === 'task' ? 'Task' : 'Article'}
                      </span>
                      {t.labels?.slice(0, 3).map((l, i) => (
                        <LabelBadge key={i} name={l} />
                      ))}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
