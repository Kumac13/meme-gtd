import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LabelsService } from '../api/services/LabelsService';
import { LinksService } from '../api/services/LinksService';
import { validateMemoBody } from '../utils/validation';
import type { LinkDisplayItem } from '../types/links';
import IssueForm, { type IssueFormValues } from './IssueForm';

const linkTypeLabels: Record<string, string> = {
  parent: 'PARENT',
  child: 'CHILD',
  relates: 'RELATED',
  derived_from: 'DERIVED FROM',
};
const EMPTY_LABELS: string[] = [];
const EMPTY_PROJECT_IDS: number[] = [];
const EMPTY_LINKS: LinkDisplayItem[] = [];

interface MemoFormProps {
  initialBodyMd?: string;
  memoId?: number;
  mode: 'create' | 'edit';
  fromTaskId?: number;
  initialLabels?: string[];
  initialProjectIds?: number[];
  initialLinks?: LinkDisplayItem[];
}

interface InheritedLinksProps {
  links: LinkDisplayItem[];
  onRemove: (linkId: number) => void;
}

function InheritedLinks({ links, onRemove }: InheritedLinksProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (links.length === 0) return null;

  return (
    <div className="border-b border-gray-200 pb-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="block text-sm font-medium text-gray-700 group-hover:text-gray-900">
          Links ({links.length})
        </span>
        <span className="text-gray-400 group-hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="space-y-2 mt-2">
          {links.map((link) => (
            <div key={link.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {linkTypeLabels[link.linkType] || link.linkType.toUpperCase()}
                </span>
                <span className="text-sm text-gray-700">
                  #{link.targetIssue.id} - {link.targetIssue.title}
                </span>
              </div>
              <button type="button" onClick={() => onRemove(link.id)} className="text-gray-400 hover:text-red-500" title="Remove link">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Memo-specific persistence bound to the shared issue form. */
export default function MemoForm({
  initialBodyMd = '',
  memoId,
  mode,
  fromTaskId,
  initialLabels = EMPTY_LABELS,
  initialProjectIds = EMPTY_PROJECT_IDS,
  initialLinks = EMPTY_LINKS,
}: MemoFormProps) {
  const navigate = useNavigate();
  const [inheritedLinks, setInheritedLinks] = useState<LinkDisplayItem[]>(initialLinks);

  useEffect(() => {
    setInheritedLinks(initialLinks);
  }, [initialLinks]);

  const handleSubmit = async (values: IssueFormValues) => {
    if (mode === 'edit' && memoId) {
      await MemosService.updateMemo(String(memoId), { bodyMd: values.bodyMd });
      navigate(`/memos/${memoId}`);
      return;
    }

    const memo = await MemosService.createMemo({ bodyMd: values.bodyMd });

    const mutations: Promise<unknown>[] = [
      ...values.labelIds.map((labelId) =>
        LabelsService.assignLabelToIssue(String(memo.id), { labelId })
      ),
      ...values.projectIds.map((projectId) =>
        ProjectsService.addProjectItem(String(projectId), { issueId: memo.id })
      ),
    ];

    if (fromTaskId) {
      mutations.push(
        LinksService.createLink({
          sourceIssueId: memo.id,
          targetIssueId: fromTaskId,
          linkType: 'derived_from',
        })
      );
      mutations.push(
        ...inheritedLinks.map((link) =>
          LinksService.createLink(
            link.direction === 'outgoing'
              ? {
                  sourceIssueId: memo.id,
                  targetIssueId: link.targetIssue.id,
                  linkType: link.linkType,
                }
              : {
                  sourceIssueId: link.sourceIssueId,
                  targetIssueId: memo.id,
                  linkType: link.linkType,
                }
          )
        )
      );
    }

    await Promise.all(mutations);
    navigate(`/memos/${memo.id}`);
  };

  return (
    <IssueForm
      initialBodyMd={initialBodyMd}
      initialLabelNames={initialLabels}
      initialProjectIds={initialProjectIds}
      titleLabel=""
      bodyLabel="Memo Content (Markdown)"
      bodyPlaceholder="Enter your memo content in Markdown format..."
      bodyHint="Supports Markdown formatting. Max 10,000 characters."
      bodyRows={15}
      bodyMinHeightClass="min-h-[300px]"
      submitLabel={mode === 'create' ? 'Create Memo' : 'Update Memo'}
      errorTitle="Error saving memo"
      showTitle={false}
      showProjects={mode === 'create'}
      showLabels={mode === 'create'}
      showLinks={false}
      validate={(values) => {
        const validation = validateMemoBody(values.bodyMd);
        return validation.isValid ? null : validation.error || 'Invalid memo body';
      }}
      onSubmit={handleSubmit}
      onCancel={() => navigate(mode === 'edit' && memoId ? `/memos/${memoId}` : '/memos')}
      renderExtraFields={() => (
        mode === 'create' && fromTaskId ? (
          <InheritedLinks
            links={inheritedLinks}
            onRemove={(linkId) => setInheritedLinks((links) => links.filter((link) => link.id !== linkId))}
          />
        ) : null
      )}
    />
  );
}
