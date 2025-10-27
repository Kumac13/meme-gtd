import { Link } from 'react-router-dom';
import { formatDateTime, formatRelativeTime } from '../utils/dates';
import { truncateMarkdown } from '../utils/markdown';

interface BaseItem {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  commentCount?: number;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Task extends BaseItem {
  status: string | null;
  scheduledOn: string | null;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

type Item = BaseItem | Task | Project;

interface ItemListProps {
  items: Item[];
  itemType: 'memo' | 'task' | 'project';
  basePath: string;
}

function isTask(item: Item): item is Task {
  return 'scheduledOn' in item;
}

function isProject(item: Item): item is Project {
  return 'name' in item && 'description' in item;
}

export default function ItemList({ items, itemType: _itemType, basePath }: ItemListProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
      {items.map((item) => {
        // Determine the correct path based on item type
        let itemPath = `${basePath}/${item.id}`;
        if (basePath === '') {
          // Mixed mode: determine path based on item type
          if (isProject(item)) {
            itemPath = `/projects/${item.id}`;
          } else if (isTask(item)) {
            itemPath = `/tasks/${item.id}`;
          } else {
            itemPath = `/memos/${item.id}`;
          }
        }

        return (
        <Link
          key={item.id}
          to={itemPath}
          className="block p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isProject(item) ? (
                <>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">
                    {item.name}
                  </h2>
                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <span>#{item.id}</span>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </>
              ) : isTask(item) ? (
                <>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-base font-semibold text-gray-900">
                      {item.title || `Task #${item.id}`}
                    </h2>
                    {item.labels && item.labels.length > 0 && (
                      <>
                        {item.labels.map((label, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-800"
                          >
                            {label}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <span>#{item.id}</span>
                    {isTask(item) && item.scheduledOn && (
                      <span>
                        Scheduled: {formatDateTime(item.scheduledOn).split(' ')[0]}
                      </span>
                    )}
                    <span title={formatDateTime(item.createdAt)}>
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="text-gray-900 text-sm">
                      {truncateMarkdown(item.bodyMd, 150)}
                    </p>
                  </div>
                  {item.labels && item.labels.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {item.labels.map((label, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-800"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center text-xs text-gray-500 space-x-3">
                    <span>#{item.id}</span>
                    <span title={formatDateTime(item.createdAt)}>
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                </>
              )}
            </div>
            {!isProject(item) && (
              <div className="flex-shrink-0 flex items-center gap-2">
                {(item.commentCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                    </svg>
                    {item.commentCount ?? 0}
                  </span>
                )}
                {item.isBookmarked && (
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path>
                  </svg>
                )}
              </div>
            )}
          </div>
        </Link>
        );
      })}
    </div>
  );
}
