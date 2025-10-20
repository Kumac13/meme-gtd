import { Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { TasksService } from '../api/services/TasksService';
import EditableContent from './EditableContent';
import CommentSection from './CommentSection';

export interface Label {
  name: string;
  color: string;
}

export interface BaseItem {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: Label[];
  createdAt: string;
  updatedAt: string;
}

export interface Task extends BaseItem {
  status: string | null;
  scheduledOn: string | null;
}

export type Item = BaseItem | Task;

interface ItemDetailProps {
  item: Item;
  itemType: 'memo' | 'task';
  basePath: string;
  onDelete: () => Promise<void>;
  onBookmarkToggle: () => Promise<void>;
  onUpdate: (updatedItem: Item) => void;
  deleting: boolean;
  bookmarking: boolean;
}

export default function ItemDetail({
  item,
  itemType,
  basePath,
  onDelete,
  onBookmarkToggle,
  onUpdate,
  bookmarking,
}: ItemDetailProps) {

  const handleUpdateBody = async (newBody: string, newTitle?: string) => {
    const updatedItem =
      itemType === 'memo'
        ? await MemosService.updateMemo(String(item.id), {
            bodyMd: newBody,
          })
        : await TasksService.updateTask(String(item.id), {
            title: newTitle !== undefined ? newTitle : item.title || undefined,
            bodyMd: newBody,
          });
    onUpdate(updatedItem as Item);
  };

  const handleDeleteBody = async () => {
    await onDelete();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={basePath}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to {itemType === 'memo' ? 'memos' : 'tasks'}
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">
              {item.title || `${itemType === 'memo' ? 'Memo' : 'Task'} #${item.id}`}
            </h1>
            {item.labels && item.labels.length > 0 && (
              <>
                {item.labels.map((label, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 text-sm font-medium rounded"
                    style={{
                      backgroundColor: `#${label.color}`,
                      color: '#000',
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </>
            )}
          </div>
          <button
            onClick={onBookmarkToggle}
            disabled={bookmarking}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={item.isBookmarked ? 'Unbookmark' : 'Bookmark'}
          >
            {item.isBookmarked ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Body content */}
      <EditableContent
        content={item.bodyMd}
        createdAt={item.createdAt}
        updatedAt={item.updatedAt}
        onSave={handleUpdateBody}
        onDelete={handleDeleteBody}
        title={item.title}
        showTitleEdit={itemType === 'task'}
      />

      {/* Comments section */}
      <CommentSection itemId={item.id} itemType={itemType} />
    </div>
  );
}
