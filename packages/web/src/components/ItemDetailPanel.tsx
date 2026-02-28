import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TasksService } from '../api/services/TasksService';
import { MemosService } from '../api/services/MemosService';
import { ArticlesService } from '../api/services/ArticlesService';
import ItemDetail, { type Item, type Comment } from './ItemDetail';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import type { IssueType } from 'meme-gtd-shared';
import { copyItemContent } from '../utils/copyContent';

interface BaseItem {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Task extends BaseItem {
  status: string | null;
  scheduledOn: string | null;
  endDate: string | null;
}

// Using shared IssueType

interface ItemDetailPanelProps {
  itemId: number | null;
  itemType: IssueType | null;
  onClose: () => void;
  onItemUpdated?: () => void;
}

export function ItemDetailPanel({ itemId, itemType, onClose, onItemUpdated }: ItemDetailPanelProps) {
  const navigate = useNavigate();
  const [item, setItem] = useState<BaseItem | Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!itemId || !itemType) {
      setItem(null);
      return;
    }

    const fetchItem = async () => {
      try {
        setLoading(true);
        setError(null);
        let response;
        if (itemType === 'task') {
          response = await TasksService.getTask(String(itemId));
        } else if (itemType === 'article') {
          response = await ArticlesService.getArticle(String(itemId));
        } else {
          response = await MemosService.getMemo(String(itemId));
        }
        setItem(response as BaseItem | Task);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to load ${itemType}`);
        console.error(`Error fetching ${itemType}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [itemId, itemType]);

  if (!itemId || !itemType) return null;

  const handleDelete = async () => {
    if (!itemId) return;

    try {
      setDeleting(true);
      if (itemType === 'task') {
        await TasksService.deleteTask(String(itemId));
      } else if (itemType === 'article') {
        await ArticlesService.deleteArticle(String(itemId));
      } else {
        await MemosService.deleteMemo(String(itemId));
      }
      onItemUpdated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete ${itemType}`);
      console.error(`Error deleting ${itemType}:`, err);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!itemId || !item) return;

    try {
      setBookmarking(true);
      if (itemType === 'task') {
        if (item.isBookmarked) {
          await TasksService.unbookmarkTask(String(itemId));
        } else {
          await TasksService.bookmarkTask(String(itemId));
        }
      } else {
        if (item.isBookmarked) {
          await MemosService.unbookmarkMemo(String(itemId));
        } else {
          await MemosService.bookmarkMemo(String(itemId));
        }
      }
      setItem({ ...item, isBookmarked: !item.isBookmarked });
      onItemUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
      console.error('Error toggling bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  const handleUpdate = (updatedItem: Item) => {
    setItem(updatedItem as BaseItem | Task);
    onItemUpdated?.();
  };

  const handleCommentsLoaded = (loadedComments: Comment[]) => {
    setComments(loadedComments);
  };

  const handleCopyAllContents = async () => {
    await copyItemContent({
      title: item?.title || null,
      body: item?.bodyMd || '',
      comments,
      includeTitle: itemType !== 'memo',
    });
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStatusChange = async (status: string) => {
    if (!itemId || itemType !== 'task') return;

    try {
      const updatedTask = await TasksService.updateTask(String(itemId), {
        status: status as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled'
      });
      setItem(updatedTask as Task);
      onItemUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
    }
  };

  const basePath = itemType === 'task' ? '/tasks' : itemType === 'article' ? '/articles' : '/memos';
  const displayTitle = item?.title || (itemType === 'task' ? 'Task' : itemType === 'article' ? 'Article' : 'Memo');

  // Generate sidebarActions based on itemType
  const sidebarActions = itemType === 'task' ? (
    <>
      <button
        onClick={handleCopyAllContents}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        {isCopied ? 'Copied!' : 'Copy All Contents'}
      </button>
      <Link
        to={`/memos/new?fromTask=${itemId}`}
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        Archive to Memo
      </Link>
    </>
  ) : itemType === 'memo' ? (
    <>
      <button
        onClick={handleCopyAllContents}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        {isCopied ? 'Copied!' : 'Copy All Contents'}
      </button>
      <Link
        to={`/tasks/new?fromMemo=${itemId}`}
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        Promote to Task
      </Link>
    </>
  ) : null;

  return (
    <>
      {/* Backdrop: semi-transparent on mobile, invisible on desktop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
        onClick={onClose}
      />

      {/* Panel: full width on mobile, right half on desktop */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-1/2 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col overflow-hidden rounded-t-xl sm:rounded-none">
        {/* Header with title, #ID link and close button */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {loading ? 'Loading...' : displayTitle}
            </h2>
            <button
              onClick={() => {
                onClose();
                navigate(`${basePath}/${itemId}`);
              }}
              className="text-gray-500 hover:text-github-green-600 text-sm font-medium flex-shrink-0"
            >
              #{itemId}
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && <LoadingState message={`Loading ${itemType}...`} />}

          {error && !loading && (
            <ErrorState error={error} title={`Error loading ${itemType}`} />
          )}

          {!loading && !error && item && (
            <ItemDetail
              item={item as Item}
              itemType={itemType}
              onDelete={handleDelete}
              onBookmarkToggle={itemType !== 'article' ? handleBookmarkToggle : undefined}
              onUpdate={handleUpdate}
              onStatusChange={itemType === 'task' ? handleStatusChange : undefined}
              deleting={deleting}
              bookmarking={itemType !== 'article' ? bookmarking : undefined}
              mode="panel"
              onBeforeNavigate={onClose}
              sidebarActions={sidebarActions}
              onCommentsLoaded={handleCommentsLoaded}
            />
          )}
        </div>
      </div>
    </>
  );
}
