import { Link } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { TasksService } from '../api/services/TasksService';
import EditableContent from './EditableContent';
import CommentSection from './CommentSection';
import LinkSection from './LinkSection';
import { ProjectsSection } from './ProjectsSection';
import { LabelsSection } from './LabelsSection';
import { ScheduleSection } from './ScheduleSection';
import { LabelBadge } from './LabelBadge';
import { StatusSelector } from './StatusSelector';
import { createBackUrl } from '../utils/navigationHelpers';

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


export interface BaseItem {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task extends BaseItem {
  status: string | null;
  scheduledOn: string | null;
  endDate: string | null;
}

export type Item = BaseItem | Task;

interface ItemDetailProps {
  item: Item;
  itemType: 'memo' | 'task';
  basePath: string;
  returnFilters?: string | null;
  onDelete: () => Promise<void>;
  onBookmarkToggle: () => Promise<void>;
  onUpdate: (updatedItem: Item) => void;
  onStatusChange?: (status: string) => Promise<void>;
  deleting: boolean;
  bookmarking: boolean;
  customActions?: React.ReactNode;
}

export default function ItemDetail({
  item,
  itemType,
  basePath,
  returnFilters,
  onDelete,
  onBookmarkToggle,
  onUpdate,
  onStatusChange,
  bookmarking,
  customActions,
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

  const handleLabelsChanged = () => {
    // Refresh item data to show updated labels
    const fetchUpdatedItem = async () => {
      const updatedItem =
        itemType === 'memo'
          ? await MemosService.getMemo(String(item.id))
          : await TasksService.getTask(String(item.id));
      onUpdate(updatedItem as Item);
    };
    fetchUpdatedItem();
  };

  const backUrl = createBackUrl({
    basePath,
    returnFiltersEncoded: returnFilters,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header - Full width */}
      <div className="mb-4">
        <Link
          to={backUrl}
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to {itemType === 'memo' ? 'memos' : 'tasks'}
        </Link>
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-3xl font-bold text-gray-900">
            {item.title || `${itemType === 'memo' ? 'Memo' : 'Task'} #${item.id}`}
          </h1>
          <div className="flex items-center gap-2">
            {itemType === 'task' && 'status' in item && onStatusChange && (
              <StatusSelector
                value={item.status || 'inbox'}
                onChange={onStatusChange}
                options={TASK_STATUS_OPTIONS}
              />
            )}
            {customActions}
            <button
              onClick={onBookmarkToggle}
              disabled={bookmarking}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
        {item.labels && item.labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {item.labels.map((label, idx) => (
              <LabelBadge key={idx} name={label} />
            ))}
          </div>
        )}
      </div>

      {/* Two column layout */}
      <div className="flex gap-6 flex-col lg:flex-row lg:items-start">
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
            showTitleEdit={itemType === 'task'}
          />

          {/* Links section */}
          <LinkSection itemId={item.id} itemType={itemType} />

          {/* Comments section */}
          <CommentSection itemId={item.id} itemType={itemType} />
        </div>

        {/* Sidebar (right column) */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
          {/* Projects Section */}
          <ProjectsSection itemId={item.id} itemType={itemType} />

          {/* Schedule Section */}
          {itemType === 'task' && 'scheduledOn' in item && (
            <ScheduleSection
              scheduledOn={item.scheduledOn}
              startTime={(item as any).startTime}
              endDate={item.endDate}
              endTime={(item as any).endTime}
              duration={(item as any).duration}
              onScheduleChange={async (updates) => {
                if (onUpdate) {
                  const updatedItem = await TasksService.updateTask(String(item.id), updates);
                  onUpdate(updatedItem as Item);
                }
              }}
            />
          )}

          {/* Labels Section */}
          <LabelsSection
            itemId={item.id}
            itemType={itemType}
            assignedLabels={item.labels || []}
            onLabelsChanged={handleLabelsChanged}
          />
        </div>
      </div>
    </div>
  );
}
