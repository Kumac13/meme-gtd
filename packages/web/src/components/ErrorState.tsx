interface ErrorStateProps {
  error: string;
  title?: string;
}

export default function ErrorState({ error, title = 'Error' }: ErrorStateProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-red-600 text-xl">⚠</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{title}</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
