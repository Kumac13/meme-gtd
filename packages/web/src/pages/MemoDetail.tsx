import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { IssueType } from 'meme-gtd-shared';
import { MemosService } from '../api/services/MemosService';
import { CommentsService } from '../api/services/CommentsService';
import ItemDetail, { type Item, type Comment } from '../components/ItemDetail';
import { copyItemContent } from '../utils/copyContent';
import { ItemDetailPanel } from '../components/ItemDetailPanel';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useDocumentTitle, truncateForTitle } from '../hooks/useDocumentTitle';
import { MarkdownRenderer } from '../utils/markdown';
import { LabelBadge } from '../components/LabelBadge';
import MobileFloatingComposer from '../components/MobileFloatingComposer';
import { formatTimelineTime, shouldShowGapTimestamp } from '../utils/memoTimeline';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useAutoGrow } from '../hooks/useAutoGrow';
import { ProjectsSection } from '../components/ProjectsSection';
import { LabelsSection } from '../components/LabelsSection';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

interface MemoComment {
  id: number;
  issueId: number;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

interface MobileThreadItemProps {
  content: string;
  createdAt: string;
  labels?: string[];
  showInlineTime?: boolean;
  showMenu?: boolean;
  onSave: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function MobileThreadItem({
  content,
  createdAt,
  labels,
  showInlineTime = false,
  showMenu = true,
  onSave,
  onDelete,
}: MobileThreadItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { copied, copy } = useCopyToClipboard();

  useAutoGrow(textareaRef, value, isEditing);

  useEffect(() => {
    if (!isEditing) {
      setValue(content);
    }
  }, [content, isEditing]);

  const handleSave = async () => {
    if (!value.trim()) return;
    try {
      setSaving(true);
      await onSave(value);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    await onDelete();
    setMenuOpen(false);
  };

  return (
    <div className="group relative py-1">
      {showInlineTime && (
        <div className="mb-1 text-[11px] text-gray-400">{formatTimelineTime(createdAt)}</div>
      )}

      {!isEditing && showMenu && (
        <div className="relative">
          <div className="absolute right-0 top-0">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="More options"
              className="rounded p-1 text-gray-500"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
              </svg>
            </button>
          </div>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 mt-1 w-32 rounded-md border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await copy(content);
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isEditing ? (
        <div>
          <textarea
            ref={textareaRef}
            rows={2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-[44px] max-h-[50vh] w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-github-green-500"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setValue(content);
              }}
              disabled={saving}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !value.trim()}
              className="rounded-md bg-github-green-600 px-3 py-1 text-sm text-white hover:bg-github-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm prose-p:my-0 prose-li:my-0 prose-p:text-[13px] prose-p:leading-6 max-w-none break-words pr-8 text-gray-700">
          <MarkdownRenderer content={content} />
        </div>
      )}

      {labels && labels.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {labels.map((label) => (
            <LabelBadge key={label} name={label} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: number; type: IssueType } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [threadComments, setThreadComments] = useState<MemoComment[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Set document title based on memo body preview (memos don't have titles)
  const titleText = memo?.bodyMd ? truncateForTitle(memo.bodyMd) : null;
  useDocumentTitle(titleText);

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
        const commentResponse = await CommentsService.listMemoComments(id);
        setThreadComments(commentResponse as MemoComment[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memo');
        console.error('Error fetching memo:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemo();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;

    try {
      setDeleting(true);
      await MemosService.deleteMemo(id);
      navigate('/memos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memo');
      console.error('Error deleting memo:', err);
      setDeleting(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!id || !memo) return;

    try {
      setBookmarking(true);
      if (memo.isBookmarked) {
        await MemosService.unbookmarkMemo(id);
      } else {
        await MemosService.bookmarkMemo(id);
      }
      setMemo({ ...memo, isBookmarked: !memo.isBookmarked });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
      console.error('Error toggling bookmark:', err);
    } finally {
      setBookmarking(false);
    }
  };

  const handleItemClick = useCallback((itemId: number, itemType: IssueType) => {
    setSelectedItem({ id: itemId, type: itemType });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleCommentsLoaded = useCallback((loadedComments: Comment[]) => {
    setThreadComments(loadedComments as MemoComment[]);
  }, []);

  const handleCopyAllContents = async () => {
    await copyItemContent({
      title: null,
      body: memo?.bodyMd || '',
      comments: threadComments,
      includeTitle: false,
    });
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleMemoUpdate = useCallback(async (bodyMd: string) => {
    if (!id || !memo) return;
    const updated = await MemosService.updateMemo(id, { bodyMd });
    setMemo(updated as Memo);
  }, [id, memo]);

  const handleReplySubmit = useCallback(async () => {
    if (!id || replySubmitting || !replyBody.trim()) return;

    try {
      setReplySubmitting(true);
      const created = await CommentsService.createMemoComment(id, { bodyMd: replyBody.trim() });
      setThreadComments((prev) => [...prev, created as MemoComment]);
      setReplyBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reply');
      console.error('Error creating reply:', err);
    } finally {
      setReplySubmitting(false);
    }
  }, [id, replyBody, replySubmitting]);

  const handleReplyUpdate = useCallback(async (commentId: number, bodyMd: string) => {
    if (!id) return;
    const updated = await CommentsService.updateMemoComment(id, String(commentId), { bodyMd });
    setThreadComments((prev) => prev.map((comment) => (
      comment.id === commentId ? (updated as MemoComment) : comment
    )));
  }, [id]);

  const handleReplyDelete = useCallback(async (commentId: number) => {
    if (!id) return;
    await CommentsService.deleteMemoComment(id, String(commentId));
    setThreadComments((prev) => prev.filter((comment) => comment.id !== commentId));
  }, [id]);

  const handleLabelsChanged = useCallback(async () => {
    if (!id) return;
    const refreshed = await MemosService.getMemo(id);
    setMemo(refreshed as Memo);
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading memo..." />;
  }

  if (error || !memo) {
    return <ErrorState error={error || 'Memo not found'} title="Error loading memo" />;
  }

  return (
    <div className="relative">
      <div className="sm:hidden mx-auto flex h-[calc(100dvh-4rem)] max-w-4xl flex-col overflow-hidden bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-2">
          <div className="pb-1">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs text-gray-500">#{memo.id}</div>
              <button
                type="button"
                onClick={() => void handleBookmarkToggle()}
                disabled={bookmarking}
                className="inline-flex items-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={memo.isBookmarked ? 'Unbookmark' : 'Bookmark'}
                aria-label={memo.isBookmarked ? 'Unbookmark memo' : 'Bookmark memo'}
              >
                {memo.isBookmarked ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z" />
                  </svg>
                )}
              </button>
            </div>
            <MobileThreadItem
              content={memo.bodyMd}
              createdAt={memo.createdAt}
              labels={memo.labels}
              showInlineTime
              showMenu
              onSave={handleMemoUpdate}
              onDelete={handleDelete}
            />
          </div>

          <div className="pt-0.5">
            {threadComments.map((comment, index) => {
              const prevCreatedAt = index > 0 ? threadComments[index - 1].createdAt : memo.createdAt;
              return (
                <div key={comment.id}>
                  {shouldShowGapTimestamp(prevCreatedAt, comment.createdAt) && (
                    <div className="pb-1 text-[11px] text-gray-400">{formatTimelineTime(comment.createdAt)}</div>
                  )}
                  <MobileThreadItem
                    content={comment.bodyMd}
                    createdAt={comment.createdAt}
                    showMenu
                    onSave={(bodyMd) => handleReplyUpdate(comment.id, bodyMd)}
                    onDelete={() => handleReplyDelete(comment.id)}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-3 space-y-3">
            <ProjectsSection itemId={memo.id} itemType="memo" />
            <LabelsSection
              itemId={memo.id}
              itemType="memo"
              assignedLabels={memo.labels || []}
              onLabelsChanged={handleLabelsChanged}
            />
          </div>

          <button
            type="button"
            onClick={handleCopyAllContents}
            className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {isCopied ? 'Copied!' : 'Copy All Contents'}
          </button>
        </div>

        <MobileFloatingComposer
          value={replyBody}
          onChange={setReplyBody}
          onSubmit={handleReplySubmit}
          placeholder="Write a comment..."
          submitLabel="Comment"
          disabled={replySubmitting}
          submitting={replySubmitting}
        />
      </div>

      <div className="hidden sm:block">
        <ItemDetail
          item={memo}
          itemType="memo"
          onDelete={handleDelete}
          onBookmarkToggle={handleBookmarkToggle}
          onUpdate={(updatedItem: Item) => setMemo(updatedItem as Memo)}
          deleting={deleting}
          bookmarking={bookmarking}
          sidebarActions={(
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
                to={`/tasks/new?fromMemo=${id}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Promote to Task
              </Link>
            </>
          )}
          onItemClick={handleItemClick}
          onCommentsLoaded={handleCommentsLoaded}
        />
        <ItemDetailPanel
          itemId={selectedItem?.id ?? null}
          itemType={selectedItem?.type ?? null}
          onClose={handlePanelClose}
        />
      </div>
    </div>
  );
}
