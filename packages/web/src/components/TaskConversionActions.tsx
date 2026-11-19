import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import ConfirmationModal from './ConfirmationModal';

/** Task詳細とサイドパネルの変換操作を揃える。 */
export default function TaskConversionActions({ taskId, onConverted }: {
  taskId: number;
  onConverted?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [target, setTarget] = useState<'article' | 'memo' | null>(null);
  const convert = async () => {
    if (!target) return;
    const path = target === 'article'
      ? `/articles/${(await TasksService.archiveTaskToArticle(String(taskId))).articleId}`
      : `/memos/${(await TasksService.transferTaskToMemo(String(taskId))).memoId}`;
    onConverted?.();
    navigate(path, { replace: target === 'memo' && location.pathname === `/tasks/${taskId}` });
  };
  return <div className="space-y-2">
    <button type="button" disabled={target !== null} onClick={() => setTarget('article')} className="block text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">
      Archive to Article
    </button>
    <button type="button" disabled={target !== null} onClick={() => setTarget('memo')} className="block text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">
      Transfer to Memo
    </button>
    <ConfirmationModal
      isOpen={target !== null}
      title={target === 'article' ? 'Archive to Article?' : 'Transfer to Memo?'}
      confirmLabel={target === 'article' ? 'Archive to Article' : 'Transfer to Memo'}
      onConfirm={convert}
      onClose={() => setTarget(null)}
    >
      {target === 'article'
        ? `Copy task #${taskId} and its comments to a new article? The original task will remain unchanged. The article and copied comments will use the current date and time.`
        : `Change task #${taskId} itself into a memo? It will no longer appear as a task. The title text, body, comments, original dates, and relationships will be kept. Task status and scheduling will be removed.`}
    </ConfirmationModal>
  </div>;
}
