import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TemplateTarget } from 'meme-gtd-shared';
import { TemplatesService } from '../api/services/TemplatesService';
import IssueForm, { type IssueFormValues } from './IssueForm';

interface TemplateFormProps {
  mode: 'create' | 'edit';
  templateId?: number;
  initialTitle?: string;
  initialBodyMd?: string;
  initialTarget?: TemplateTarget;
  initialLabelIds?: number[];
  initialProjectIds?: number[];
  onCancel?: () => void;
}

/**
 * Template create/edit form. A thin wrapper over the shared IssueForm adding the
 * one template-specific field — the target (task/article the template produces)
 * — and template persistence. Links are not shown (a scaffold has no links);
 * labels/projects are preset here and copied onto the new issue on apply.
 */
export default function TemplateForm({
  mode,
  templateId,
  initialTitle = '',
  initialBodyMd = '',
  initialTarget = 'task',
  initialLabelIds = [],
  initialProjectIds,
  onCancel,
}: TemplateFormProps) {
  const navigate = useNavigate();
  const [target, setTarget] = useState<TemplateTarget>(initialTarget);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate(mode === 'edit' && templateId ? `/templates/${templateId}` : '/templates');
  };

  const handleSubmit = async (values: IssueFormValues) => {
    const payload = {
      title: values.title,
      bodyMd: values.bodyMd,
      templateTarget: target,
      labels: values.labelNames,
      projectIds: values.projectIds,
    };
    if (mode === 'create') {
      await TemplatesService.createTemplate(payload);
      navigate('/templates');
    } else if (mode === 'edit' && templateId) {
      await TemplatesService.updateTemplate(String(templateId), payload);
      // The detail route IS this edit form, so navigating to it again would be
      // an invisible no-op — go back to the list as the completion feedback.
      navigate('/templates');
    }
  };

  return (
    <IssueForm
      initialTitle={initialTitle}
      initialBodyMd={initialBodyMd}
      initialLabelIds={initialLabelIds}
      initialProjectIds={initialProjectIds}
      titleLabel="Template Name *"
      titlePlaceholder="Enter template name..."
      bodyLabel="Template Body (Markdown)"
      bodyPlaceholder="Enter the body skeleton copied into the new item..."
      bodyHint="Copied into the new item's body when the template is applied."
      submitLabel={mode === 'create' ? 'Create Template' : 'Update Template'}
      errorTitle="Error saving template"
      showProjects
      showLabels
      showLinks={false}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      renderExtraFields={() => (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Creates</label>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setTarget('task')}
              className={`flex-1 px-3 py-2 text-sm ${target === 'task' ? 'bg-github-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Task
            </button>
            <button
              type="button"
              onClick={() => setTarget('article')}
              className={`flex-1 px-3 py-2 text-sm border-l border-gray-300 ${target === 'article' ? 'bg-github-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Article
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">The issue type this template produces when applied.</p>
        </div>
      )}
    />
  );
}
