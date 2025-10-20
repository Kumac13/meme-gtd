interface EmptyStateProps {
  message: string;
  submessage?: string;
}

export default function EmptyState({ message, submessage }: EmptyStateProps) {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg">
      <p className="text-gray-500 text-lg">{message}</p>
      {submessage && <p className="text-gray-400 text-sm mt-2">{submessage}</p>}
    </div>
  );
}
