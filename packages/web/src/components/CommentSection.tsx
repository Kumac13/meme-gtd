import type { IssueReferenceTitles } from '../utils/issueReferenceTitles';
import { useState, useRef, useMemo } from 'react';
import type { IssueType } from 'meme-gtd-shared';
import EditableContent from './EditableContent';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { getShortcutHint } from '../utils/keyboard';
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
  issueId?: number;
  enableInteractiveTodos?: boolean;
  issueReferenceTitles?: IssueReferenceTitles;
  /** Click handler for `#id` links inside rendered comment bodies. */
  onIssueLinkClick?: (id: number, type: IssueType) => void;
}

export default function CommentSection({
  comments,
  loading,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  activities = [],
  issueId,
  enableInteractiveTodos = false,
  onIssueLinkClick,
  issueReferenceTitles,
}: CommentSectionProps) {
  const [newCommentBody, setNewCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          {/* Continuous vertical line – start from the center of the first activity icon */}
          {(timelineEntries.length > 0) && (
            <div className="absolute left-[31px] top-3 bottom-0 w-0.5 bg-gray-300" />
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
                    enableInteractiveTodos={enableInteractiveTodos}
                    onIssueLinkClick={onIssueLinkClick}
                    issueReferenceTitles={issueReferenceTitles}
                  />
                );
              }

              // Activity: icon with white circle bg sits ON the line
              return (
                <ActivityRow key={key} activity={entry.activity} issueId={issueId} />
              );
            })}

            {/* New Comment Form */}
            <form onSubmit={handleSubmitNewComment} className="relative bg-white border border-gray-200 rounded-lg p-4">
        <MarkdownTextarea
          textareaRef={textareaRef}
          value={newCommentBody}
          onChange={setNewCommentBody}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Write a comment..."
          disabled={submitting}
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

export function ActivityRow({ activity, issueId }: { activity: ActivityLogEntry; issueId?: number }) {
  const align = activity.eventType.startsWith('link.') ? 'items-start' : 'items-center';
  return (
    <div className={`flex ${align} gap-2 py-0.5 pl-5 pr-4`}>
      <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400">
        {getActivityIcon(activity.eventType)}
      </span>
      <ActivityTimelineItem activity={activity} issueId={issueId} />
    </div>
  );
}
