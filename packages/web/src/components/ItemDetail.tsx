import { Link } from 'react-router-dom';
import { formatDateTime } from '../utils/dates';
import { MarkdownRenderer } from '../utils/markdown';

interface Label {
  name: string;
  color: string;
}

interface BaseItem {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: Label[];
  createdAt: string;
  updatedAt: string;
}

interface Task extends BaseItem {
  status: string | null;
  scheduledOn: string | null;
}

type Item = BaseItem | Task;

interface ItemDetailProps {
  item: Item;
  itemType: 'memo' | 'task';
  basePath: string;
  onDelete: () => Promise<void>;
  onBookmarkToggle: () => Promise<void>;
  deleting: boolean;
  bookmarking: boolean;
}

function isTask(item: Item): item is Task {
  return 'scheduledOn' in item;
}

export default function ItemDetail({
  item,
  itemType,
  basePath,
  onDelete,
  onBookmarkToggle,
  deleting,
  bookmarking,
}: ItemDetailProps) {
  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${item.title || `${itemType === 'memo' ? 'Memo' : 'Task'} #${item.id}`}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    await onDelete();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with actions */}
      <div className="mb-6">
        <Link
          to={basePath}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to {itemType === 'memo' ? 'memos' : 'tasks'}
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
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
          </div>
          <div className="flex space-x-2">
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
            <Link
              to={`${basePath}/${item.id}/edit`}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="mb-6 flex items-center text-sm text-gray-500 space-x-4 border-b border-gray-200 pb-4">
        {isTask(item) && item.scheduledOn && (
          <span className="font-medium text-gray-700">
            Scheduled: {formatDateTime(item.scheduledOn).split(' ')[0]}
          </span>
        )}
        <span>Created: {formatDateTime(item.createdAt)}</span>
        {item.updatedAt !== item.createdAt && (
          <span>Updated: {formatDateTime(item.updatedAt)}</span>
        )}
      </div>

      {/* Body content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {item.bodyMd ? (
          <div className="prose prose-sm max-w-none">
            <MarkdownRenderer content={item.bodyMd} />
          </div>
        ) : (
          <p className="text-gray-400 italic">No {itemType === 'memo' ? 'content' : 'description'}</p>
        )}
      </div>
    </div>
  );
}
