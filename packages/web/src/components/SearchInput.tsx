import { useState, useEffect } from 'react';
import { IoSearch, IoClose } from 'react-icons/io5';

export type SearchMode = 'keyword' | 'semantic';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When provided, shows a keyword/semantic mode toggle */
  searchMode?: SearchMode;
  /** Callback when search mode changes */
  onSearchModeChange?: (mode: SearchMode) => void;
}

/**
 * Simple search input component for free-text search
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search tasks',
  searchMode,
  onSearchModeChange,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

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
    <div className="flex-1 flex items-center gap-2">
      <div className="relative flex-1">
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
      {searchMode && onSearchModeChange && (
        <div className="relative inline-flex rounded-md bg-white p-0.5 shrink-0 self-stretch">
          <button
            onClick={() => onSearchModeChange('keyword')}
            className={`relative px-3 text-xs font-medium rounded transition-all ${
              searchMode === 'keyword'
                ? 'bg-github-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Keyword
          </button>
          <button
            onClick={() => onSearchModeChange('semantic')}
            className={`relative px-3 text-xs font-medium rounded transition-all ${
              searchMode === 'semantic'
                ? 'bg-github-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Semantic
          </button>
        </div>
      )}
    </div>
  );
}
