import type { ActivityCategory } from '../utils/activityLogHelpers';

interface ActivityCategoryFilterProps {
  category: ActivityCategory;
  onCategoryChange: (category: ActivityCategory) => void;
}

const categories: { value: ActivityCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'memos', label: 'Memos' },
  { value: 'projects', label: 'Projects' },
  { value: 'labels', label: 'Labels' },
  { value: 'articles', label: 'Articles' },
  { value: 'links', label: 'Links' },
  { value: 'comments', label: 'Comments' },
];

export function ActivityCategoryFilter({
  category,
  onCategoryChange,
}: ActivityCategoryFilterProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onCategoryChange(cat.value)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            category === cat.value
              ? 'bg-github-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
