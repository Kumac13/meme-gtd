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
      {searchMode && onSearchModeChange && (
        <div className="flex mt-1.5 gap-1">
          <button
            onClick={() => onSearchModeChange('keyword')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              searchMode === 'keyword'
                ? 'bg-github-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Keyword
          </button>
          <button
            onClick={() => onSearchModeChange('semantic')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              searchMode === 'semantic'
                ? 'bg-github-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semantic
          </button>
        </div>
      )}
    </div>
  );
}
