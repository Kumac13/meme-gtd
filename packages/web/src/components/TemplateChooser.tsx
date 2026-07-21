import { useEffect, useMemo, useState } from 'react';
import { LabelsService } from '../api/services/LabelsService';
import { TemplatesService } from '../api/services/TemplatesService';

type TemplateTarget = 'task' | 'article';

interface TemplateListItem {
  id: number;
  title: string | null;
}

interface AppliedTemplate {
  bodyMd: string;
  labelIds: number[];
  projectIds: number[];
}

interface TemplateChooserProps {
  target: TemplateTarget;
  blankLabel: string;
  onBlank: () => void;
  onTemplate: (template: AppliedTemplate) => void;
}

/** Blank／Template 選択と、フォーム初期値への変換を一元管理する。 */
export default function TemplateChooser({
  target,
  blankLabel,
  onBlank,
  onTemplate,
}: TemplateChooserProps) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await TemplatesService.listTemplates(undefined, undefined, undefined, target);
        setTemplates((response?.data ?? []) as TemplateListItem[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };

    void loadTemplates();
  }, [target]);

  const filteredTemplates = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => (template.title ?? '').toLowerCase().includes(query));
  }, [filter, templates]);

  const applyTemplate = async (templateId: number) => {
    try {
      setIsApplying(true);
      setError(null);
      const [template, allLabels] = await Promise.all([
        TemplatesService.getTemplate(String(templateId)),
        LabelsService.listLabels(),
      ]);
      const labelNameToId = new Map(
        (allLabels as Array<{ id: number; name: string }>).map((label) => [label.name, label.id])
      );

      onTemplate({
        bodyMd: template.bodyMd,
        labelIds: (template.labels ?? [])
          .map((name: string) => labelNameToId.get(name))
          .filter((labelId): labelId is number => typeof labelId === 'number'),
        projectIds: template.projectIds ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBlank}
        disabled={isApplying}
        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 text-left disabled:opacity-50"
      >
        {blankLabel}
      </button>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Templates</label>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col" style={{ maxHeight: '300px' }}>
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Filter templates..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
            />
          </div>
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-y-auto p-2">
              <div className="space-y-1">
                {filteredTemplates.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-gray-500 text-center">
                    {filter.trim() ? 'No templates match your search' : `No ${target} templates available`}
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => void applyTemplate(template.id)}
                      disabled={isApplying}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-left disabled:opacity-50"
                    >
                      <span className="text-sm text-gray-900 truncate">
                        {template.title || `Template #${template.id}`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
