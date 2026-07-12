import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TemplateTarget } from 'meme-gtd-shared';
import { TemplatesService } from '../../api/services/TemplatesService';
import { LabelsService } from '../../api/services/LabelsService';
import TemplateForm from '../../components/TemplateForm';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';

interface InitialValues {
  title: string;
  bodyMd: string;
  target: TemplateTarget;
  labelIds: number[];
  projectIds: number[];
}

export default function TemplateDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initial, setInitial] = useState<InitialValues | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tpl, allLabels] = await Promise.all([
          TemplatesService.getTemplate(id as string),
          LabelsService.listLabels(),
        ]);
        const nameToId = new Map(
          (allLabels as Array<{ id: number; name: string }>).map((l) => [l.name, l.id])
        );
        const labelIds = (tpl.labels ?? [])
          .map((name: string) => nameToId.get(name))
          .filter((x): x is number => typeof x === 'number');
        setInitial({
          title: tpl.title ?? '',
          bodyMd: tpl.bodyMd,
          target: tpl.templateTarget,
          labelIds,
          projectIds: tpl.projectIds ?? [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LoadingState message="Loading template..." />;
  if (error) return <ErrorState error={error} title="Error loading template" />;
  if (!initial) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/templates"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to templates
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Template</h1>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TemplateForm
          mode="edit"
          templateId={Number(id)}
          initialTitle={initial.title}
          initialBodyMd={initial.bodyMd}
          initialTarget={initial.target}
          initialLabelIds={initial.labelIds}
          initialProjectIds={initial.projectIds}
        />
      </div>
    </div>
  );
}
