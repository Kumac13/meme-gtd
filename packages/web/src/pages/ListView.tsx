import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import EmptyState from '../components/EmptyState';

interface OutletContext {
  project: ProjectDetail;
}

export default function ListView() {
  const { project } = useOutletContext<OutletContext>();

  if (project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return (
    <div className="space-y-2">
      {project.items.map(item => (
        <div
          key={item.id}
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
        >
          {/* Issue ID */}
          <span className="text-sm text-gray-500 font-mono">
            #{item.issueId}
          </span>

          {/* Type Badge */}
          <span
            className={`
              text-xs px-2 py-1 rounded font-medium
              ${item.issue.type === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
            `}
          >
            {item.issue.type}
          </span>

          {/* Title */}
          <a
            href={`/${item.issue.type}s/${item.issueId}`}
            className="flex-1 text-gray-900 hover:text-github-green-600 font-medium"
          >
            {item.issue.title}
          </a>

          {/* Column (if applicable) */}
          {item.viewMeta?.column && (
            <span className="text-sm text-gray-600">
              {item.viewMeta.column}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
