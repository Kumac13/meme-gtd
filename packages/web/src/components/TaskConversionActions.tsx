import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';

/** Task詳細とサイドパネルの変換操作を揃える。 */
export default function TaskConversionActions({ taskId, onConverted }: {
  taskId: number;
  onConverted?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const convert = async (target: 'article' | 'memo') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const path = target === 'article'
        ? `/articles/${(await TasksService.archiveTaskToArticle(String(taskId))).articleId}`
        : `/memos/${(await TasksService.transferTaskToMemo(String(taskId))).memoId}`;
      onConverted?.();
      navigate(path, { replace: target === 'memo' && location.pathname === `/tasks/${taskId}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert task');
      setBusy(false);
    }
  };
  return <div className="space-y-2">
    <button disabled={busy} onClick={() => convert('article')} className="block text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">
      Archive to Article
    </button>
    <button disabled={busy} onClick={() => convert('memo')} className="block text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">
      Transfer to Memo
    </button>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
