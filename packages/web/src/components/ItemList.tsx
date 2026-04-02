import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDateTime, formatRelativeTime } from "../utils/dates";
import { InlineMarkdownRenderer, extractFirstLine } from "../utils/markdown";
import { extractSnippet, highlightKeyword } from "../utils/searchHighlight";
import { LabelBadge } from "./LabelBadge";
import RelevanceIndicator from "./RelevanceIndicator";
import { createItemDetailUrl } from "../utils/navigationHelpers";
import type { Article, IssueType } from "meme-gtd-shared";

// Status badge labels and colors
const statusLabels: Record<string, string> = {
  inbox: "Inbox",
  open: "Open",
  next: "Next",
  waiting: "Waiting",
  scheduled: "Scheduled",
  someday: "Someday",
  done: "Done",
  canceled: "Canceled",
};

const statusBadgeClasses: Record<string, string> = {
  inbox: "bg-gray-100 text-gray-700",
  open: "bg-blue-100 text-blue-700",
  next: "bg-green-100 text-green-700",
  waiting: "bg-yellow-100 text-yellow-700",
  scheduled: "bg-purple-100 text-purple-700",
  someday: "bg-orange-100 text-orange-700",
  done: "bg-gray-200 text-gray-500",
  canceled: "bg-red-100 text-red-500",
};

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
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

type Item = BaseItem | Task | Project | Article; // Include Article

interface ItemListProps {
  items: Item[];
itemType: IssueType | "project";
  basePath: string;
  currentFilters?: URLSearchParams;
  onDelete?: (id: number) => Promise<void>;
  onItemClick?: (id: number, type: IssueType) => void; // Allow "article"
  /** Show status badges on tasks and "Documents" badge on memos (only for project ListView) */
  showStatusBadges?: boolean;
  /** Match snippets from keyword search (issueId -> snippet text) */
  matchSnippets?: Record<number, string>;
  /** Search query for keyword highlighting */
  searchQuery?: string;
  /** Relevance scores from semantic search (issueId -> score 0-1) */
  relevanceScores?: Record<number, number>;
}

function isTask(item: Item): item is Task {
  return "type" in item && (item as any).type === "task";
}

function isProject(item: Item): item is Project {
  return "name" in item && "description" in item && !("type" in item); // Check for "type" to distinguish from Task/Memo/Article
}

function isArticle(item: Item): item is Article {
  return "type" in item && (item as any).type === "article";
}

export default function ItemList({
  items,
  itemType: _itemType,
  basePath,
  currentFilters,
  onDelete,
  onItemClick,
  showStatusBadges = false,
  matchSnippets,
  searchQuery,
  relevanceScores,
}: ItemListProps) {
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onDelete) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      setDeleting(id);
      await onDelete(id);
      setMenuOpenId(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    } finally {
      setDeleting(null);
    }
  };

  const renderSnippet = (itemId: number) => {
    const raw = matchSnippets?.[itemId];
    if (!raw) return null;
    const snippet = searchQuery
      ? extractSnippet(raw, searchQuery)
      : raw;
    return (
      <div className="text-xs text-gray-500 mt-1">
        {highlightKeyword(snippet, searchQuery)}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
      {items.map((item) => {
        let itemPath: string;
        let itemType: "memo" | "task" | "project" | "article";

        if (isProject(item)) {
          itemType = "project";
          itemPath = createItemDetailUrl({ basePath: "/projects", itemId: item.id, currentFilters });
        } else if (isTask(item)) {
          itemType = "task";
          itemPath = createItemDetailUrl({ basePath: "/tasks", itemId: item.id, currentFilters });
        } else if (isArticle(item)) { // Added for Article
          itemType = "article";
          itemPath = createItemDetailUrl({ basePath: "/articles", itemId: item.id, currentFilters });
        } else {
          itemType = "memo";
          itemPath = createItemDetailUrl({ basePath: "/memos", itemId: item.id, currentFilters });
        }

        if (basePath !== "") {
          itemPath = createItemDetailUrl({
            basePath,
            itemId: item.id,
            currentFilters,
          });
        }

        const handleClick = (e: React.MouseEvent) => {
          if (onItemClick) {
            e.preventDefault();
            onItemClick(item.id, itemType as IssueType);
          }
        };

        const relevanceScore = relevanceScores?.[item.id];
        const bgStyle = relevanceScore != null
          ? { backgroundColor: `rgba(45, 164, 78, ${relevanceScore * 0.12})` }
          : undefined;

        return (
          <div key={item.id} className="relative">
            <Link
              to={itemPath}
              onClick={handleClick}
              className="block p-4 hover:bg-gray-50 transition-colors"
              style={bgStyle}
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
                        {(item.startDate || item.endDate) && (
                          <span>
                            {item.startDate && item.endDate
                              ? `${item.startDate} → ${item.endDate}`
                              : item.startDate
                                ? `From ${item.startDate}`
                                : `Until ${item.endDate}`}
                          </span>
                        )}
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </>
                  ) : isTask(item) ? (
                    <>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="text-base text-gray-900">
                          {searchQuery && item.title
                            ? highlightKeyword(item.title, searchQuery)
                            : (item.title || `Task #\${item.id}`)}
                        </h2>
                        {showStatusBadges && item.status && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadgeClasses[item.status] || "bg-gray-100 text-gray-700"}`}>
                            {statusLabels[item.status] || item.status}
                          </span>
                        )}
                        {item.labels && item.labels.length > 0 && (
                          <>
                            {item.labels.slice(0, 3).map((label, idx) => (
                              <LabelBadge key={idx} name={label} />
                            ))}
                            {item.labels.length > 3 && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                +{item.labels.length - 3} more
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {renderSnippet(item.id)}
                      {relevanceScore != null && <RelevanceIndicator score={relevanceScore} />}
                      <div className="flex items-center text-xs text-gray-500 space-x-3 mt-1">
                        <span>#{item.id}</span>
                        {isTask(item) && item.scheduledOn && (
                          <span>
                            Scheduled: {formatDateTime(item.scheduledOn).split(" ")[0]}
                          </span>
                        )}
                        <span title={formatDateTime(item.createdAt)}>
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </>
                  ) : isArticle(item) ? ( // Article-specific rendering
                    <>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="text-base text-gray-900">
                          {item.title || `Article #\${item.id}`}
                        </h2>
                        {showStatusBadges && (
                           <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                             Article
                           </span>
                        )}
                        {item.labels && item.labels.length > 0 && (
                          <>
                            {item.labels.slice(0, 3).map((label, idx) => (
                              <LabelBadge key={idx} name={label} />
                            ))}
                            {item.labels.length > 3 && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                +{item.labels.length - 3} more
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {relevanceScore != null && <RelevanceIndicator score={relevanceScore} />}
                      <div className="flex items-center text-xs text-gray-500 space-x-3">
                        <span>#{item.id}</span>
                        {(item.meta as Article["meta"])?.siteName && (
                          <span title={(item.meta as Article["meta"]).originalUrl}>
                            {(item.meta as Article["meta"]).siteName}
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
                          {item.bodyMd && item.bodyMd.trim() ? (
                            <InlineMarkdownRenderer content={extractFirstLine(item.bodyMd, 150)} />
                          ) : (
                            <span className="text-gray-500">Memo #{item.id}</span>
                          )}
                        </p>
                        {showStatusBadges && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
                            Documents
                          </span>
                        )}
                      </div>
                      {item.labels && item.labels.length > 0 && (
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {item.labels.slice(0, 3).map((label, idx) => (
                            <LabelBadge key={idx} name={label} />
                          ))}
                          {item.labels.length > 3 && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                              +{item.labels.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      {renderSnippet(item.id)}
                      {relevanceScore != null && <RelevanceIndicator score={relevanceScore} />}
                      <div className="flex items-center text-xs text-gray-500 space-x-3">
                        <span>#{item.id}</span>
                        <span title={formatDateTime(item.createdAt)}>
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {!isProject(item) && (
                    <>
                      {(item.commentCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                          </svg>
                          {item.commentCount ?? 0}
                        </span>
                      )}
                      {item.isBookmarked && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.75.75 0 0 1 3 14.25Z"></path>
                        </svg>
                      )}
                    </>
                  )}
                  {onDelete && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === item.id ? null : item.id);
                        }}
                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        aria-label="More options"
                        disabled={deleting === item.id}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
                        </svg>
                      </button>
                      {menuOpenId === item.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                            <button
                              onClick={(e) => handleDelete(e, item.id)}
                              disabled={deleting === item.id}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deleting === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}