import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import EmptyState from '../components/EmptyState';
import { Link } from 'react-router-dom';

interface OutletContext {
  project: ProjectDetail;
}

export default function ListView() {
  const { project } = useOutletContext<OutletContext>();

  if (project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
      {project.items.map(item => {
        const detailPath = `/${item.issue.type}s/${item.issueId}`;
        const statusLabel = item.issue.type === 'task' && item.issue.status
          ? item.issue.status.charAt(0).toUpperCase() + item.issue.status.slice(1)
          : null;

        return (
          <Link
            key={item.id}
            to={detailPath}
            className="block p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-base font-semibold text-gray-900">
                    {item.issue.title}
                  </h2>
                  {item.issue.type === 'task' && statusLabel && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-800">
                      {statusLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-xs text-gray-500 space-x-3">
                  <span>#{item.issueId}</span>
                  <span className={`
                    ${item.issue.type === 'task' ? 'text-blue-600' : 'text-purple-600'}
                  `}>
                    {item.issue.type}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
