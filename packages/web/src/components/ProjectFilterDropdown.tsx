import { PROJECT_STATUS_LABELS } from '../utils/projectStatus';
import { FilterDropdown } from './FilterControls';

interface ProjectFilterItem {
  id: number;
  name: string;
  status: string;
}

interface ProjectFilterDropdownProps {
  projects: ProjectFilterItem[];
  selectedIds: Set<number>;
  includesNoProject: boolean;
  label: string;
  onToggle: (projectId: number) => void;
  onToggleNoProject: () => void;
  onClear: () => void;
}

/** Shared project multi-select used by Task, Memo and Article lists. */
export default function ProjectFilterDropdown({
  projects,
  selectedIds,
  includesNoProject,
  label,
  onToggle,
  onToggleNoProject,
  onClear,
}: ProjectFilterDropdownProps) {
  const isActive = selectedIds.size > 0 || includesNoProject;

  if (projects.length === 0) return null;

  const selectionIcon = (selected: boolean) => (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selected ? 'currentColor' : 'none'}>
      {selected ? (
        <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      ) : (
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />
      )}
    </svg>
  );

  return (
    <FilterDropdown label={label} active={isActive} onClear={onClear} panelClassName="min-w-[280px] max-w-[400px] max-h-64 overflow-y-auto">
          <button type="button" onClick={onToggleNoProject} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
            {selectionIcon(includesNoProject)}
            <span className="text-gray-500 italic truncate">No Project</span>
          </button>
          {projects.map((project) => (
            <button key={project.id} type="button" onClick={() => onToggle(project.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
              {selectionIcon(selectedIds.has(project.id))}
              <span className="text-gray-700 truncate">{project.name}</span>
              <span className="text-xs text-gray-400 ml-auto shrink-0">{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
            </button>
          ))}
    </FilterDropdown>
  );
}
