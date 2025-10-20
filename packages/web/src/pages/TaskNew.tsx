import { Link } from 'react-router-dom';
import TaskForm from '../components/TaskForm';

export default function TaskNew() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to="/tasks"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to tasks
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Task</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TaskForm mode="create" />
      </div>
    </div>
  );
}
