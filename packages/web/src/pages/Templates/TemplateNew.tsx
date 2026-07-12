import { Link } from 'react-router-dom';
import TemplateForm from '../../components/TemplateForm';

export default function TemplateNew() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/templates"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to templates
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Template</h1>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TemplateForm mode="create" />
      </div>
    </div>
  );
}
