import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import MemoForm from '../components/MemoForm';
import FormPageLayout from '../components/FormPageLayout';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

export default function MemoEdit() {
  const { id } = useParams<{ id: string }>();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemo() {
      if (!id) {
        setError('Memo ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await MemosService.getMemo(id);
        setMemo(response as Memo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memo');
        console.error('Error fetching memo:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemo();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading memo..." />;
  }

  if (error || !memo) {
    return <ErrorState error={error || 'Memo not found'} title="Error loading memo" />;
  }

  return (
    <FormPageLayout
      backTo={`/memos/${memo.id}`}
      backLabel="Back to memo"
      title={`Edit ${memo.title || `Memo #${memo.id}`}`}
    >
      <MemoForm mode="edit" memoId={memo.id} initialBodyMd={memo.bodyMd} />
    </FormPageLayout>
  );
}
