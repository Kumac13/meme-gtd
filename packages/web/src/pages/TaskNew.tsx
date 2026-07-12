import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { LabelsService } from '../api/services/LabelsService';
import { TemplatesService } from '../api/services/TemplatesService';
import TaskForm from '../components/TaskForm';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import type { PendingLink } from '../types/links';

interface TaskTemplateItem {
  id: number;
  title: string | null;
}

// Chooser fetch cap; combined with server-side search + a scrollable list so the
// page stays usable however many templates exist.
const TEMPLATE_PAGE = 50;

export default function TaskNew() {
  const [searchParams] = useSearchParams();
  const fromMemoId = searchParams.get('fromMemo');

  const [memo, setMemo] = useState<any>(null);
  const [initialBody, setInitialBody] = useState<string | undefined>(undefined);
  const [initialLabelIds, setInitialLabelIds] = useState<number[] | undefined>(undefined);
  const [initialProjectIds, setInitialProjectIds] = useState<number[] | undefined>(undefined);
  const [initialLinks, setInitialLinks] = useState<PendingLink[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blank / template chooser (skipped when promoting a memo).
  const [phase, setPhase] = useState<'choose' | 'form'>(fromMemoId ? 'form' : 'choose');
  const [templates, setTemplates] = useState<TaskTemplateItem[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSearch, setTplSearch] = useState('');
  const [tplTotal, setTplTotal] = useState(0);

  useEffect(() => {
    if (fromMemoId && fromMemoId !== null) {
      async function fetchMemo() {
        try {
          setLoading(true);
          setError(null);
          const [memoData, preview, allLabels] = await Promise.all([
            MemosService.getMemo(fromMemoId as string),
            MemosService.getPromotePreview(fromMemoId as string),
            LabelsService.listLabels(),
          ]);
          setMemo(memoData);
          setInitialBody(preview.bodyMd);

          const labelNameToId = new Map(allLabels.map((l: { id: number; name: string }) => [l.name, l.id]));
          const labelIds = preview.labels
            .map((name: string) => labelNameToId.get(name))
            .filter((id): id is number => typeof id === 'number');
          setInitialLabelIds(labelIds);

          setInitialProjectIds(preview.projectIds);

          const allowedLinkTypes = new Set(['parent', 'child', 'relates', 'derived_from']);
          const carriedLinks: PendingLink[] = preview.linkedIssues
            .filter((l) => allowedLinkTypes.has(l.linkType))
            .map((l) => ({
              linkKind: 'issue',
              targetIssueId: l.targetIssue.id,
              linkType: l.linkType as 'parent' | 'child' | 'relates' | 'derived_from',
              targetIssue: {
                id: l.targetIssue.id,
                type: l.targetIssue.type as 'task' | 'memo' | 'article',
                title: l.targetIssue.title,
              },
            }));

          const memoIdNum = parseInt(fromMemoId as string, 10);
          const memoTitle = (memoData.bodyMd ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80) || `Memo #${memoIdNum}`;
          const derivedFromLink: PendingLink = {
            linkKind: 'issue',
            targetIssueId: memoIdNum,
            linkType: 'derived_from',
            isPromotion: true,
            targetIssue: { id: memoIdNum, type: 'memo', title: memoTitle },
          };
          setInitialLinks([derivedFromLink, ...carriedLinks]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load memo');
          console.error('Error fetching memo:', err);
        } finally {
          setLoading(false);
        }
      }
      fetchMemo();
    }
  }, [fromMemoId]);

  useEffect(() => {
    if (phase === 'choose') {
      const load = async () => {
        try {
          setTplLoading(true);
          // Server-side search + cap; the chooser list itself scrolls.
          const res = await TemplatesService.listTemplates(TEMPLATE_PAGE, undefined, tplSearch || undefined, 'task');
          setTemplates((res?.data ?? []) as TaskTemplateItem[]);
          setTplTotal(res?.total ?? 0);
        } catch (err) {
          console.error('Failed to load templates:', err);
        } finally {
          setTplLoading(false);
        }
      };
      load();
    }
  }, [phase, tplSearch]);

  // Apply a task template: prefill body/labels/projects (title stays empty).
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
    return <LoadingState message={memo ? 'Loading memo...' : 'Loading...'} />;
  }

  if (error) {
    return <ErrorState error={error} title="Error creating task" />;
  }

  if (phase === 'choose') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="mb-6">
          <Link to="/tasks" className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block">
            ← Back to tasks
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Task</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <p className="px-4 py-3 text-sm text-gray-500 border-b border-gray-200">Choose a starting point</p>
          <button onClick={() => setPhase('form')} className="block w-full text-left p-4 hover:bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-medium text-gray-900">Blank task</div>
            <div className="text-xs text-gray-500">Start from scratch</div>
          </button>
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Filter templates..."
              value={tplSearch}
              onChange={(e) => setTplSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
            />
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-200">
            {tplLoading ? (
              <div className="p-4 text-sm text-gray-500">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                {tplSearch.trim() ? 'No templates match your filter' : 'No task templates yet'}
              </div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className="block w-full text-left px-4 py-3 hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-900">{t.title || `Template #${t.id}`}</span>
                </button>
              ))
            )}
          </div>
          {!tplLoading && tplTotal > templates.length && (
            <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
              Showing {templates.length} of {tplTotal} — narrow with the filter
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/tasks"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to tasks
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {memo ? 'Promote Memo to Task' : 'Create New Task'}
        </h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TaskForm
          mode="create"
          initialBodyMd={initialBody ?? memo?.bodyMd}
          initialLabelIds={initialLabelIds}
          initialProjectIds={initialProjectIds}
          initialLinks={initialLinks}
        />
      </div>
    </div>
  );
}
