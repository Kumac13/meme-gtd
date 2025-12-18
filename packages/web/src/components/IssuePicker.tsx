/**
 * IssuePicker Component
 *
 * Searchable picker for selecting tasks or memos as link targets.
 * Provides:
 * - Text search with debounce
 * - Initial display of recent items
 * - Keyboard navigation (arrow keys, Enter, Esc)
 * - Combined search across tasks and memos
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IssuePickerItem } from '../types/links';
import { TasksService } from '../api/services/TasksService';
import { MemosService } from '../api/services/MemosService';
import { ArticlesService } from '../api/services/ArticlesService';

interface IssuePickerProps {
  /** ID to exclude from results (e.g., current issue being edited) */
  excludeId?: number;
  /** Callback when an issue is selected */
  onSelect: (issue: IssuePickerItem) => void;
  /** Callback when picker is cancelled */
  onCancel: () => void;
}

/**
 * Convert a Task API response to IssuePickerItem
 */
function taskToPickerItem(task: {
  id: number;
  title: string;
  status: string;
  updatedAt: string;
}): IssuePickerItem {
  return {
    id: task.id,
    type: 'task',
    title: task.title,
    status: task.status,
    updatedAt: task.updatedAt,
  };
}

/**
 * Convert a Memo API response to IssuePickerItem
 */
function memoToPickerItem(memo: {
  id: number;
  bodyMd: string;
  updatedAt: string;
}): IssuePickerItem {
  // Extract first line as title
  const firstLine = memo.bodyMd.split('\n')[0]?.trim() || '(Untitled)';
  // Truncate if too long
  const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

  return {
    id: memo.id,
    type: 'memo',
    title,
    status: null,
    updatedAt: memo.updatedAt,
  };
}

/**
 * Convert an Article API response to IssuePickerItem
 */
function articleToPickerItem(article: {
  id: number;
  title: string;
  updatedAt: string;
}): IssuePickerItem {
  // Truncate title if too long
  const title = article.title.length > 50 ? article.title.slice(0, 47) + '...' : article.title;

  return {
    id: article.id,
    type: 'article',
    title,
    status: null,
    updatedAt: article.updatedAt,
  };
}

export default function IssuePicker({
  excludeId,
  onSelect,
  onCancel,
}: IssuePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<IssuePickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Fetch issues (tasks, memos, and articles) and merge results
   */
  const fetchIssues = useCallback(async (search: string) => {
    setIsLoading(true);
    setError(null);
    setFocusedIndex(-1);

    try {
      // Parallel fetch of tasks, memos, and articles
      const [tasksResponse, memosResponse, articles] = await Promise.all([
        TasksService.listTasks(undefined, undefined, undefined, search || undefined),
        MemosService.listMemos(undefined, undefined, search || undefined),
        ArticlesService.listArticles(undefined, undefined, search || undefined),
      ]);

      // Convert to unified format
      const taskItems = (tasksResponse?.data || []).map(taskToPickerItem);
      const memoItems = (memosResponse?.data || []).map(memoToPickerItem);
      const articleItems = (articles?.data || []).map(articleToPickerItem);

      // Merge and sort by updatedAt (descending)
      let merged = [...taskItems, ...memoItems, ...articleItems];
      merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // Exclude self if specified
      if (excludeId !== undefined) {
        merged = merged.filter(item => item.id !== excludeId);
      }

      // Limit to 10 items
      merged = merged.slice(0, 10);

      setItems(merged);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
      setError('Search failed');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [excludeId]);

  /**
   * Debounced search effect
   */
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchIssues(searchTerm);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, fetchIssues]);

  /**
   * Focus input on mount
   */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev =>
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev =>
          prev > 0 ? prev - 1 : prev
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          onSelect(items[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
    }
  };

  /**
   * Handle item click
   */
  const handleItemClick = (item: IssuePickerItem) => {
    onSelect(item);
  };

  /**
   * Scroll focused item into view
   */
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      focusedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search issues..."
          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="issue-picker-list"
          aria-activedescendant={focusedIndex >= 0 ? `issue-picker-item-${items[focusedIndex]?.id}` : undefined}
        />
      </div>

      {/* Results List */}
      <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md">
        {/* Loading State */}
        {isLoading && (
          <div className="p-4 text-center text-sm text-gray-500">
            <svg className="animate-spin h-5 w-5 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="mt-2 block">Searching...</span>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-4 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && items.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No matching items found
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && items.length > 0 && (
          <>
            {/* Label */}
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
              {searchTerm ? 'Results:' : 'Recent:'}
            </div>

            <ul
              ref={listRef}
              id="issue-picker-list"
              role="listbox"
              className="py-1"
            >
              {items.map((item, index) => (
                <li
                  key={`${item.type}-${item.id}`}
                  id={`issue-picker-item-${item.id}`}
                  role="option"
                  aria-selected={index === focusedIndex}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                    index === focusedIndex
                      ? 'bg-github-green-50 text-github-green-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Type Badge */}
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    item.type === 'task'
                      ? 'bg-blue-100 text-blue-700'
                      : item.type === 'memo'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {item.type === 'task' ? 'Task' : item.type === 'memo' ? 'Memo' : 'Article'}
                  </span>

                  {/* ID */}
                  <span className="text-xs text-gray-500">#{item.id}</span>

                  {/* Title */}
                  <span className="flex-1 text-sm text-gray-900 truncate">
                    {item.title}
                  </span>

                  {/* Status (Task only) */}
                  {item.status && (
                    <span className="text-xs text-gray-500 capitalize">
                      {item.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Cancel Button */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
