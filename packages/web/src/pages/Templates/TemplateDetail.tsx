import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TemplatesService } from '../../api/services/TemplatesService';
import ItemDetail, { type Item } from '../../components/ItemDetail';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface Template {
  id: number;
  title: string | null;
  bodyMd: string;
  templateTarget: 'task' | 'article';
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Template detail page. Mirrors TaskDetail's screen anatomy via the shared
 * ItemDetail: title header, editable body card, and the Projects/Labels
 * sidebar sections, plus a template-only "Creates" section.
 */
export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useDocumentTitle(template?.title ?? null);

  useEffect(() => {
    async function fetchTemplate() {
      if (!id) {
        setError('Template ID is required');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await TemplatesService.getTemplate(id);
        setTemplate(response as Template);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
        console.error('Error fetching template:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await TemplatesService.deleteTemplate(id);
      navigate('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      console.error('Error deleting template:', err);
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading template..." />;
  }

  if (error || !template) {
    return <ErrorState error={error || 'Template not found'} title="Error loading template" />;
  }

  const handleUpdate = (updatedItem: Item) => {
    setTemplate(updatedItem as unknown as Template);
  };

  const customActions = (
    <button
      onClick={() => navigate('/templates/new')}
      className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
    >
      New Template
    </button>
  );

  return (
    <ItemDetail
      item={template}
      itemType="template"
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      deleting={deleting}
      customActions={customActions}
    />
  );
}
