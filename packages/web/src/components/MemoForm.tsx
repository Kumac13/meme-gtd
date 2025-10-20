import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { validateMemoBody } from '../utils/validation';

interface MemoFormProps {
  initialBodyMd?: string;
  memoId?: number;
  mode: 'create' | 'edit';
}

export default function MemoForm({ initialBodyMd = '', memoId, mode }: MemoFormProps) {
  const navigate = useNavigate();
  const [bodyMd, setBodyMd] = useState(initialBodyMd);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate
    const validation = validateMemoBody(bodyMd);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid memo body');
      return;
    }
    setValidationError(null);

    try {
      setSubmitting(true);
      setError(null);

      if (mode === 'create') {
        const response = await MemosService.createMemo({ bodyMd });
        navigate(`/memos/${response.id}`);
      } else if (mode === 'edit' && memoId) {
        await MemosService.updateMemo(memoId.toString(), { bodyMd });
        navigate(`/memos/${memoId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memo');
      console.error('Error saving memo:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (mode === 'edit' && memoId) {
      navigate(`/memos/${memoId}`);
    } else {
      navigate('/memos');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error saving memo</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="bodyMd" className="block text-sm font-medium text-gray-700 mb-2">
          Memo Content (Markdown)
        </label>
        <textarea
          id="bodyMd"
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={15}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 focus:border-github-green-500 font-mono text-sm ${
            validationError ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter your memo content in Markdown format..."
        />
        {validationError && (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Supports Markdown formatting. Max 10,000 characters.
        </p>
      </div>

      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Create Memo' : 'Update Memo'}
        </button>
      </div>
    </form>
  );
}
