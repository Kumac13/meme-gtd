import { Link } from 'react-router-dom';
import MemoForm from '../components/MemoForm';

export default function MemoNew() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to="/memos"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to memos
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Memo</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <MemoForm mode="create" />
      </div>
    </div>
  );
}
