import { Link } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';

export default function ProjectNew() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/projects"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to projects
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ProjectForm mode="create" />
      </div>
    </div>
  );
}
