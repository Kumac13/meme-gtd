import { useNavigate } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LabelsService } from '../api/services/LabelsService';
import { validateMemoBody } from '../utils/validation';
import IssueForm, { type IssueFormValues } from './IssueForm';

const EMPTY_LABELS: string[] = [];
const EMPTY_PROJECT_IDS: number[] = [];

interface MemoFormProps {
  initialBodyMd?: string;
  memoId?: number;
  mode: 'create' | 'edit';
  initialLabels?: string[];
  initialProjectIds?: number[];
}

/** Memo-specific persistence bound to the shared issue form. */
export default function MemoForm({
  initialBodyMd = '',
  memoId,
  mode,
  initialLabels = EMPTY_LABELS,
  initialProjectIds = EMPTY_PROJECT_IDS,
}: MemoFormProps) {
  const navigate = useNavigate();
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
      validationErrorPlacement="body"
      validate={(values) => {
        const validation = validateMemoBody(values.bodyMd);
        return validation.isValid ? null : validation.error || 'Invalid memo body';
      }}
      onSubmit={handleSubmit}
      onCancel={() => navigate(mode === 'edit' && memoId ? `/memos/${memoId}` : '/memos')}

    />
  );
}
