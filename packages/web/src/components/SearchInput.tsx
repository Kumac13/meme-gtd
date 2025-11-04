import { useState, useEffect } from 'react';
import { parseSearchQuery, isValidStatus } from '../utils/queryParser';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStatusHint?: boolean;
}

/**
 * GitHub-style search input component with search button
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
  placeholder = '検索例: label:bug status:open',
  showStatusHint = true,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showHint, setShowHint] = useState(false);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Validate query and show hint for invalid syntax
  useEffect(() => {
    if (!localValue || localValue.trim() === '') {
      setShowHint(false);
      return;
    }

    const parsed = parseSearchQuery(localValue);

    // Show hint if status is invalid
    if (showStatusHint && parsed.status && !isValidStatus(parsed.status)) {
      setShowHint(true);
    } else {
      setShowHint(false);
    }
  }, [localValue, showStatusHint]);

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
    <div className="mb-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-600 focus:border-transparent pr-10"
          />
          {localValue && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-github-green-600 text-white rounded-md hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-github-green-600 focus:ring-offset-2 transition-colors"
          aria-label="Search"
        >
          🔍 検索
        </button>
      </div>

      {/* Hint for invalid syntax */}
      {showHint && (
        <div className="mt-2 text-sm text-gray-600">
          <span className="mr-2">💡</span>
          検索例: label:bug status:open
          <br />
          <span className="text-xs text-gray-500">
            有効なステータス: open, next, waiting, scheduled, done, canceled
          </span>
        </div>
      )}
    </div>
  );
}
