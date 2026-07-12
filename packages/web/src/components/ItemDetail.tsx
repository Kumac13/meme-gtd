import React, { useState, useEffect, useRef } from 'react';
import type { IssueType, TaskKind } from 'meme-gtd-shared';
import { MemosService } from '../api/services/MemosService';
import { TasksService } from '../api/services/TasksService';
import { ArticlesService } from '../api/services/ArticlesService';
import { TemplatesService } from '../api/services/TemplatesService';
import { CommentsService } from '../api/services/CommentsService';
import { ActivityLogService } from '../api/services/ActivityLogService';
import EditableContent from './EditableContent';
import CommentSection, { type Comment } from './CommentSection';
import LinkSection from './LinkSection';
import { ProjectsSection } from './ProjectsSection';
import { LabelsSection } from './LabelsSection';
import { ScheduleSection } from './ScheduleSection';
import { StatusSelector } from './StatusSelector';
import { type ActivityLogEntry } from '../utils/activityLogHelpers';
import { isDisplayedActivity } from './ActivityTimelineItem';

const TASK_STATUS_OPTIONS = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'someday', label: 'Someday' },
  { value: 'open', label: 'Open' },
  { value: 'next', label: 'Next' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

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
  taskKind: TaskKind;
  // New scheduling fields (ISO 8601 datetime)
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isAllDay: boolean;
  // Execution fields
  actualStart: string | null;
  actualEnd: string | null;
  // Deprecated fields (kept for backward compatibility)
  scheduledOn: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  duration: number | null;
}

export type Item = BaseItem | Task;

/** Issue types this detail view renders, plus templates (same screen anatomy). */
type DetailItemType = IssueType | 'template';

interface ItemDetailProps {
  item: Item;
  itemType: DetailItemType;
  onDelete: () => Promise<void>;
  onBookmarkToggle?: () => Promise<void>;
  onUpdate: (updatedItem: Item) => void;
  onStatusChange?: (status: string) => Promise<void>;
  deleting: boolean;
  bookmarking?: boolean;
  customActions?: React.ReactNode;
  /** Actions to display at the bottom of the sidebar (e.g., Archive to Memo, Promote to Task) */
  sidebarActions?: React.ReactNode;
  /** 'page' shows full layout with sidebar, 'panel' hides sidebar for compact view */
  mode?: 'page' | 'panel';
  /** Optional callback when a linked item is clicked (used in page mode for modal) */
  onItemClick?: (id: number, type: IssueType) => void;
  /** Optional callback before navigation (used in panel mode to close modal first) */
  onBeforeNavigate?: () => void;
  /** Callback to expose comments to parent component */
  onCommentsLoaded?: (comments: Comment[]) => void;
}

// Re-export Comment type for parent components
export type { Comment } from './CommentSection';

export default function ItemDetail({
  item,
  itemType,
  onDelete,
  onBookmarkToggle,
  onUpdate,
  onStatusChange,
  bookmarking,
  customActions,
  sidebarActions,
  mode = 'page',
  onItemClick,
  onBeforeNavigate,
  onCommentsLoaded,
}: ItemDetailProps) {
  // Comments & activities state management
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  // Bumped after a body/comment save so LinkSection refetches; the server may
  // have created a new `relates` link from a `#id` mention in the saved text.
  const [linksRefreshKey, setLinksRefreshKey] = useState(0);
  const bumpLinks = () => setLinksRefreshKey((k) => k + 1);

  // Store callback in ref to avoid dependency issues
  const onCommentsLoadedRef = useRef(onCommentsLoaded);
  onCommentsLoadedRef.current = onCommentsLoaded;

  useEffect(() => {
    // Skip fetching comments for templates (scaffolds have no comments/activity
    // by design).
    if (itemType === 'template') {
      setCommentsLoading(false);
      return;
    }

    const fetchComments = async () => {
      try {
        setCommentsLoading(true);
        const [commentsResponse, activitiesResponse] = await Promise.all([
          itemType === 'memo'
            ? CommentsService.listMemoComments(String(item.id))
            : itemType === 'article'
              ? CommentsService.listArticleComments(String(item.id))
              : CommentsService.listTaskComments(String(item.id)),
          ActivityLogService.getIssueActivityLog(item.id, 100, 'asc')
            .then((res) => res.filter(isDisplayedActivity))
            .catch(() => [] as ActivityLogEntry[]),
        ]);
        setComments(commentsResponse);
        setActivities(activitiesResponse);
        // Use ref to call callback without causing re-renders
        onCommentsLoadedRef.current?.(commentsResponse);
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setCommentsLoading(false);
      }
    };

    fetchComments();
  }, [item.id, itemType]);

  const handleAddComment = async (bodyMd: string) => {
    const newComment =
      itemType === 'memo'
        ? await CommentsService.createMemoComment(String(item.id), { bodyMd })
        : itemType === 'article'
          ? await CommentsService.createArticleComment(String(item.id), { bodyMd })
          : await CommentsService.createTaskComment(String(item.id), { bodyMd });
    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    onCommentsLoadedRef.current?.(updatedComments);
    bumpLinks();
  };

  const handleUpdateComment = async (commentId: number, bodyMd: string) => {
    const updatedComment =
      itemType === 'memo'
        ? await CommentsService.updateMemoComment(String(item.id), String(commentId), { bodyMd })
        : itemType === 'article'
          ? await CommentsService.updateArticleComment(String(item.id), String(commentId), { bodyMd })
          : await CommentsService.updateTaskComment(String(item.id), String(commentId), { bodyMd });
    const updatedComments = comments.map((c) => (c.id === commentId ? updatedComment : c));
    setComments(updatedComments);
    onCommentsLoadedRef.current?.(updatedComments);
    bumpLinks();
  };

  const handleDeleteComment = async (commentId: number) => {
    if (itemType === 'memo') {
      await CommentsService.deleteMemoComment(String(item.id), String(commentId));
    } else if (itemType === 'article') {
      await CommentsService.deleteArticleComment(String(item.id), String(commentId));
    } else {
      await CommentsService.deleteTaskComment(String(item.id), String(commentId));
    }
    const updatedComments = comments.filter((c) => c.id !== commentId);
    setComments(updatedComments);
    onCommentsLoadedRef.current?.(updatedComments);
  };

  const handleUpdateBody = async (newBody: string, newTitle?: string) => {
    const updatedItem =
      itemType === 'memo'
        ? await MemosService.updateMemo(String(item.id), {
          bodyMd: newBody,
        })
        : itemType === 'template'
          ? await TemplatesService.updateTemplate(String(item.id), {
            title: newTitle !== undefined ? newTitle : item.title || undefined,
            bodyMd: newBody,
          })
          : itemType === 'article'
            ? await ArticlesService.updateArticle(String(item.id), {
              title: newTitle !== undefined ? newTitle : item.title || undefined,
              bodyMd: newBody,
            })
            : await TasksService.updateTask(String(item.id), {
              title: newTitle !== undefined ? newTitle : item.title || undefined,
              bodyMd: newBody,
            });
    onUpdate(updatedItem as Item);
    bumpLinks();
  };

  const handleDeleteBody = async () => {
    await onDelete();
  };

  // Web-saved articles are archived snapshots (issues.origin='web'): the body
  // is read-only and only comments can be edited. Manual articles are fully
  // editable.
  const articleOrigin = itemType === 'article' ? (item as { origin?: string }).origin : undefined;
  const isWebArticle = articleOrigin === 'web';
  const isManualArticle = itemType === 'article' && articleOrigin === 'manual';

  const handleLabelsChanged = () => {
    // Refresh item data to show updated labels
    const fetchUpdatedItem = async () => {
      let updatedItem;
      if (itemType === 'memo') {
        updatedItem = await MemosService.getMemo(String(item.id));
      } else if (itemType === 'article') {
        updatedItem = await ArticlesService.getArticle(String(item.id));
      } else if (itemType === 'template') {
        updatedItem = await TemplatesService.getTemplate(String(item.id));
      } else {
        updatedItem = await TasksService.getTask(String(item.id));
      }
      onUpdate(updatedItem as Item);
    };
    fetchUpdatedItem();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header - Full width */}
      <div className="mb-4">
        {/* Mobile: stack vertically, Desktop: side by side */}
        <div className={`flex flex-col gap-3 mb-3 ${mode === 'page' ? 'sm:flex-row sm:items-start sm:justify-between' : ''}`}>
          {mode === 'page' && (
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {item.title || `${itemType === 'memo' ? 'Memo' : itemType === 'article' ? 'Article' : itemType === 'template' ? 'Template' : 'Task'} #${item.id}`}
            </h1>
          )}
          <div className={`flex items-center gap-2 flex-wrap justify-end ${mode === 'panel' ? 'w-full' : 'sm:flex-nowrap'}`}>
            {itemType === 'task' && 'status' in item && onStatusChange && (
              <StatusSelector
                value={item.status || 'inbox'}
                onChange={onStatusChange}
                options={TASK_STATUS_OPTIONS}
              />
            )}
            {/* Only show bookmark button if onBookmarkToggle is provided */}
            {onBookmarkToggle && (
              <button
                onClick={onBookmarkToggle}
                disabled={bookmarking}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={item.isBookmarked ? 'Unbookmark' : 'Bookmark'}
              >
                {item.isBookmarked ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path>
                  </svg>
                )}
              </button>
            )}
            {customActions}
          </div>
        </div>
      </div>

      {/* Two column layout - panel mode forces single column like mobile */}
      <div className={`flex gap-6 flex-col ${mode === 'page' ? 'lg:flex-row lg:items-start' : ''}`}>
        {/* Main content (left column) */}
        <div className="flex-1 min-w-0">
          {/* Body content */}
          <EditableContent
            content={item.bodyMd}
            createdAt={item.createdAt}
            updatedAt={item.updatedAt}
            onSave={handleUpdateBody}
            onDelete={handleDeleteBody}
            title={item.title}
            showTitleEdit={itemType === 'task' || itemType === 'template' || isManualArticle}
            enableInteractiveTodos={itemType === 'task'}
            readOnly={isWebArticle}
            onIssueLinkClick={onItemClick}
          />

          {/* Links section (not for templates — scaffolds have no links) */}
          {itemType !== 'template' && (
            <LinkSection
              itemId={item.id}
              itemType={itemType}
              onItemClick={onItemClick}
              onBeforeNavigate={onBeforeNavigate}
              parentTask={itemType === 'task' ? {
                id: item.id,
                title: item.title || '',
                status: 'status' in item ? item.status : null,
                labels: item.labels || [],
              } : undefined}
              refreshKey={linksRefreshKey}
            />
          )}

          {/* Comments section (memo/task/article) */}
          {itemType !== 'template' && (
            <CommentSection
              comments={comments}
              loading={commentsLoading}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              activities={activities}
              issueId={item.id}
              enableInteractiveTodos={itemType === 'task'}
              onIssueLinkClick={onItemClick}
            />
          )}
        </div>

        {/* Sidebar (right column on page, bottom on panel) */}
        <div className={`w-full flex-shrink-0 space-y-6 ${mode === 'page' ? 'lg:w-80' : ''}`}>
          {/* Projects Section */}
          <ProjectsSection itemId={item.id} itemType={itemType} />

          {/* Schedule Section (includes Task Kind) */}
          {itemType === 'task' && 'scheduledStart' in item && (
            <ScheduleSection
              taskKind={(item as Task).taskKind || 'action'}
              onTaskKindChange={async (newKind) => {
                const updatedItem = await TasksService.updateTask(String(item.id), {
                  taskKind: newKind,
                });
                onUpdate(updatedItem as Item);
              }}
              scheduledStart={(item as Task).scheduledStart}
              scheduledEnd={(item as Task).scheduledEnd}
              isAllDay={(item as Task).isAllDay}
              actualStart={(item as Task).actualStart}
              actualEnd={(item as Task).actualEnd}
              scheduledOn={(item as Task).scheduledOn}
              startTime={(item as Task).startTime}
              endDate={(item as Task).endDate}
              endTime={(item as Task).endTime}
              duration={(item as Task).duration}
              onScheduleChange={async (updates) => {
                if (onUpdate) {
                  const updatedItem = await TasksService.updateTask(String(item.id), updates);
                  onUpdate(updatedItem as Item);
                }
              }}
            />
          )}

          {/* Target Section (template only) — the issue type this template produces (issues.template_target) */}
          {itemType === 'template' && 'templateTarget' in item && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Target</h3>
              </div>
              <div className="flex rounded-md border border-gray-300 overflow-hidden">
                {(['task', 'article'] as const).map((target, i) => (
                  <button
                    key={target}
                    type="button"
                    onClick={async () => {
                      const updated = await TemplatesService.updateTemplate(String(item.id), { templateTarget: target });
                      onUpdate(updated as unknown as Item);
                    }}
                    className={`flex-1 px-3 py-2 text-sm ${i > 0 ? 'border-l border-gray-300' : ''} ${
                      (item as { templateTarget?: string }).templateTarget === target
                        ? 'bg-github-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {target === 'task' ? 'Task' : 'Article'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Labels Section */}
          <LabelsSection
            itemId={item.id}
            itemType={itemType}
            assignedLabels={item.labels || []}
            onLabelsChanged={handleLabelsChanged}
          />

          {/* Sidebar Actions (e.g., Archive to Memo, Promote to Task) */}
          {sidebarActions && (
            <div
              className={`border-t border-gray-200 pt-4 mt-4 ${mode === 'panel' ? 'pb-6' : ''}`}
              style={{ paddingBottom: mode === 'page' ? 'env(safe-area-inset-bottom, 0px)' : undefined }}
            >
              {sidebarActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
