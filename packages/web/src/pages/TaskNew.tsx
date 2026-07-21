import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { LabelsService } from '../api/services/LabelsService';
import TaskForm from '../components/TaskForm';
import FormPageLayout from '../components/FormPageLayout';
import TemplateCreationFlow from '../components/TemplateCreationFlow';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import type { PendingLink } from '../types/links';

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

  if (loading) {
    return <LoadingState message={memo ? 'Loading memo...' : 'Loading...'} />;
  }

  if (error) {
    return <ErrorState error={error} title="Error creating task" />;
  }

  return (
    <FormPageLayout
      backTo="/tasks"
      backLabel="Back to tasks"
      title={memo ? 'Promote Memo to Task' : 'Create New Task'}
    >
        {fromMemoId ? (
          <TaskForm
            mode="create"
            initialBodyMd={initialBody ?? memo?.bodyMd}
            initialLabelIds={initialLabelIds}
            initialProjectIds={initialProjectIds}
            initialLinks={initialLinks}
          />
        ) : (
          <TemplateCreationFlow target="task">
            {(initialValues) => (
              <TaskForm
                mode="create"
                initialBodyMd={initialValues.bodyMd}
                initialLabelIds={initialValues.labelIds}
                initialProjectIds={initialValues.projectIds}
              />
            )}
          </TemplateCreationFlow>
        )}
    </FormPageLayout>
  );
}
