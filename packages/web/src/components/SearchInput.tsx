import { useState, useEffect } from 'react';
import { IoSearch, IoClose } from 'react-icons/io5';
import { parseSearchQuery, isValidStatus } from '../utils/queryParser';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStatusHint?: boolean;
  itemType?: 'task' | 'memo';
}

/**
 * GitHub-style search input component
 *
 * Supports query syntax:
 * - label:bug → Filter by label
 * - label:bug,enhancement → Multiple labels (OR logic)
 * - status:open → Filter by status
 * - label:bug status:open → Combined filters (AND logic)
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search tasks',
  showStatusHint = true,
  itemType = 'task',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showHint, setShowHint] = useState(false);
  const [showMemoWarning, setShowMemoWarning] = useState(false);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Validate query and show hint for invalid syntax
  useEffect(() => {
    if (!localValue || localValue.trim() === '') {
      setShowHint(false);
      setShowMemoWarning(false);
      return;
    }

    const parsed = parseSearchQuery(localValue);

    // Show warning if status filter is used with memos
    if (itemType === 'memo' && parsed.status) {
      setShowMemoWarning(true);
      setShowHint(false);
      return;
    } else {
      setShowMemoWarning(false);
    }

    // Show hint if status is invalid (for tasks)
    if (showStatusHint && parsed.status && !isValidStatus(parsed.status)) {
      setShowHint(true);
    } else {
      setShowHint(false);
    }
  }, [localValue, showStatusHint, itemType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleSearch = () => {
    onChange(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="flex-1 relative">
      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-600 focus:border-transparent"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <IoClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Hint for invalid syntax - positioned absolutely to not affect layout */}
      {showHint && (
        <div className="absolute left-0 top-full mt-1 text-sm text-gray-600 bg-white border border-gray-200 rounded-md shadow-sm p-2 z-10">
          Example: label:bug status:open
          <br />
          <span className="text-xs text-gray-500">
            Valid statuses: inbox, open, next, waiting, scheduled, someday, done, canceled
          </span>
        </div>
      )}

      {/* Warning for status filter on memos */}
      {showMemoWarning && (
        <div className="absolute left-0 top-full mt-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md shadow-sm p-2 z-10">
          Note: Status filters do not apply to memos
        </div>
      )}
    </div>
  );
}
