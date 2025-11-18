import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface CopyButtonProps {
  text: string;
  ariaLabel?: string;
  className?: string;
}

export default function CopyButton({
  text,
  ariaLabel = 'Copy markdown',
  className = '',
}: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleClick = async () => {
    await copy(text);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={ariaLabel}
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
