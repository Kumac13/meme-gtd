import { useState, useRef, useMemo, DragEvent, ClipboardEvent } from 'react';
import EditableContent from './EditableContent';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
import { useImageUpload } from '../hooks/useImageUpload';
import { MarkdownTextarea } from './MarkdownTextarea';
import { ActivityTimelineItem, getActivityIcon } from './ActivityTimelineItem';
import { type ActivityLogEntry } from '../utils/activityLogHelpers';

export interface Comment {
  id: number;
  issueId: number;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
}

type TimelineEntry =
  | { type: 'comment'; comment: Comment }
  | { type: 'activity'; activity: ActivityLogEntry };

interface CommentSectionProps {
  comments: Comment[];
  loading: boolean;
  onAddComment: (bodyMd: string) => Promise<void>;
  onUpdateComment: (commentId: number, bodyMd: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  activities?: ActivityLogEntry[];
}

export default function CommentSection({
  comments,
  loading,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  activities = [],
}: CommentSectionProps) {
  const [newCommentBody, setNewCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isUploading, uploadImage } = useImageUpload();

  const handleSubmitNewComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;

    try {
      setSubmitting(true);
      await onAddComment(newCommentBody);
      setNewCommentBody('');
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = useKeyboardShortcut((e) => {
    // Get the form that contains this input element
    const form = (e.target as HTMLElement).closest('form');
    if (form) {
      form.requestSubmit();
    }
  }, { disabled: submitting || !newCommentBody.trim() });

  // Image upload handlers for new comment textarea
  const insertMarkdownRef = (markdownRef: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setNewCommentBody(prev => prev + '\n' + markdownRef);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = newCommentBody.slice(0, start);
    const after = newCommentBody.slice(end);

    const newValue = before + (before.endsWith('\n') || before === '' ? '' : '\n') + markdownRef + '\n' + after;
    setNewCommentBody(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = before.length + (before.endsWith('\n') || before === '' ? 0 : 1) + markdownRef.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleImageFile = async (file: File) => {
    if (isUploading) return;
    const result = await uploadImage(file);
    if (result.success && result.markdownRef) {
      insertMarkdownRef(result.markdownRef);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        return;
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageFile(files[0]);
    }
  };

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const commentEntries: TimelineEntry[] = comments.map((c) => ({ type: 'comment', comment: c }));
    const activityEntries: TimelineEntry[] = activities.map((a) => ({ type: 'activity', activity: a }));
    return [...commentEntries, ...activityEntries].sort((a, b) => {
      const timeA = a.type === 'comment' ? a.comment.createdAt : a.activity.occurredAt;
      const timeB = b.type === 'comment' ? b.comment.createdAt : b.activity.occurredAt;
      return timeA.localeCompare(timeB);
    });
  }, [comments, activities]);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Comments ({comments.length})
      </h2>

      {/* Timeline: continuous vertical line behind entries, cards cover it with bg-white */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="relative">
          {/* Continuous vertical line */}
          {(timelineEntries.length > 0) && (
            <div className="absolute left-[31px] top-0 bottom-0 w-0.5 bg-gray-300" />
          )}

          {/* Entries + form stacked with spacing */}
          <div className="relative flex flex-col gap-3">
            {timelineEntries.map((entry) => {
              const key = entry.type === 'comment' ? `comment-${entry.comment.id}` : `activity-${entry.activity.id}`;

              if (entry.type === 'comment') {
                return (
                  <EditableContent
                    key={key}
                    content={entry.comment.bodyMd}
                    createdAt={entry.comment.createdAt}
                    updatedAt={entry.comment.updatedAt}
                    onSave={(newBody) => onUpdateComment(entry.comment.id, newBody)}
                    onDelete={() => onDeleteComment(entry.comment.id)}
                  />
                );
              }

              // Activity: icon with white circle bg sits ON the line
              return (
                <div key={key} className="flex items-center gap-2 py-0.5 pl-5 pr-4">
                  <span className="relative z-10 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400">
                    {getActivityIcon(entry.activity.eventType)}
                  </span>
                  <ActivityTimelineItem activity={entry.activity} />
                </div>
              );
            })}

            {/* New Comment Form */}
            <form onSubmit={handleSubmitNewComment} className="relative bg-white border border-gray-200 rounded-lg p-4">
        <MarkdownTextarea
          textareaRef={textareaRef}
          value={newCommentBody}
          onChange={setNewCommentBody}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          rows={4}
          placeholder="Write a comment..."
          disabled={submitting}
          isDragging={isDragging}
          isUploading={isUploading}
          minHeightClass="min-h-[100px]"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newCommentBody.trim()}
            className="px-4 py-2 bg-github-green-600 text-white rounded-md hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Comment (${getShortcutHint()})`}
          >
            {submitting ? 'Commenting...' : 'Comment'}
          </button>
        </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
