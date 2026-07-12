import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LabelsService } from '../../api/services/LabelsService';
import { TemplatesService } from '../../api/services/TemplatesService';
import ArticleForm from '../../components/ArticleForm';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';

interface ArticleTemplateItem {
  id: number;
  title: string | null;
}

/**
 * New Article page. Same flow as New Task: a pre-screen chooses Blank or an
 * article-target template (the template's body/labels/projects prefill the
 * form; the title stays empty).
 */
export default function ArticleNew() {
  const [phase, setPhase] = useState<'choose' | 'form'>('choose');
  const [templates, setTemplates] = useState<ArticleTemplateItem[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplFilter, setTplFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialBody, setInitialBody] = useState<string | undefined>(undefined);
  const [initialLabelIds, setInitialLabelIds] = useState<number[] | undefined>(undefined);
  const [initialProjectIds, setInitialProjectIds] = useState<number[] | undefined>(undefined);

  useEffect(() => {
    if (phase === 'choose') {
      // Same approach as the Projects/Labels pickers: load once, filter locally.
      const load = async () => {
        try {
          setTplLoading(true);
          const res = await TemplatesService.listTemplates(undefined, undefined, undefined, 'article');
          setTemplates((res?.data ?? []) as ArticleTemplateItem[]);
        } catch (err) {
          console.error('Failed to load templates:', err);
        } finally {
          setTplLoading(false);
        }
      };
      load();
    }
  }, [phase]);

  // Apply an article template: prefill body/labels/projects (title stays empty).
  const applyTemplate = async (templateId: number) => {
    try {
      setLoading(true);
      const [tpl, allLabels] = await Promise.all([
        TemplatesService.getTemplate(String(templateId)),
        LabelsService.listLabels(),
      ]);
      const nameToId = new Map((allLabels as Array<{ id: number; name: string }>).map((l) => [l.name, l.id]));
      setInitialBody(tpl.bodyMd);
      setInitialLabelIds((tpl.labels ?? []).map((n: string) => nameToId.get(n)).filter((x): x is number => typeof x === 'number'));
      setInitialProjectIds(tpl.projectIds ?? []);
      setPhase('form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error creating article" />;
  }

  const filteredTemplates = templates.filter((t) =>
    tplFilter.trim() ? (t.title || '').toLowerCase().includes(tplFilter.toLowerCase()) : true
  );

  if (phase === 'choose') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="mb-6">
          <Link to="/articles" className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block">
            ← Back to articles
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Article</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <button
            type="button"
            onClick={() => setPhase('form')}
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 text-left"
          >
            Blank article
          </button>

          {/* Template picker — same structure/classes as the Projects/Labels pickers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Templates</label>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col" style={{ maxHeight: '300px' }}>
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Filter templates..."
                  value={tplFilter}
                  onChange={(e) => setTplFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                />
              </div>
              {tplLoading ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="overflow-y-auto p-2">
                  <div className="space-y-1">
                    {filteredTemplates.length === 0 ? (
                      <div className="px-2 py-4 text-sm text-gray-500 text-center">
                        {tplFilter.trim() ? 'No templates match your search' : 'No article templates available'}
                      </div>
                    ) : (
                      filteredTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyTemplate(t.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-left"
                        >
                          <span className="text-sm text-gray-900 truncate">{t.title || `Template #${t.id}`}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/articles"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to articles
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Article</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ArticleForm
          initialBodyMd={initialBody}
          initialLabelIds={initialLabelIds}
          initialProjectIds={initialProjectIds}
        />
      </div>
    </div>
  );
}
