import { useState, useEffect } from 'react';
import { IoSearch, IoClose } from 'react-icons/io5';
import type { IssueType } from 'meme-gtd-shared';
import { validateSearchQuery, type QueryValidationError } from '../utils/queryParser';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  itemType?: IssueType;
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
  itemType = 'task',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [validationError, setValidationError] = useState<QueryValidationError | null>(null);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Validate query syntax
  useEffect(() => {
    const error = validateSearchQuery(localValue, { itemType });
    setValidationError(error);
  }, [localValue, itemType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleSearch = () => {
    // Block submission only for syntax/status errors, not warnings
    // if (validationError && validationError.type !== 'warning') {
    //   return;
    // }
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

      {/* Validation error/warning message */}
      {validationError && (
        <div className={`absolute left-0 top-full mt-1 text-sm rounded-md shadow-sm p-2 z-10 ${
          validationError.type === 'warning'
            ? 'text-amber-700 bg-amber-50 border border-amber-200'
            : 'text-red-700 bg-red-50 border border-red-200'
        }`}>
          {validationError.message}
        </div>
      )}
    </div>
  );
}
