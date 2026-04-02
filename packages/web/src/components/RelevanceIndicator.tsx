/**
 * Visual indicator for semantic search relevance score.
 * Shows a thin relevance bar and percentage badge.
 */

interface RelevanceIndicatorProps {
  /** Cosine similarity score (0-1) */
  score: number;
}

/** Returns Tailwind color class based on score tier */
function getBarColorClass(score: number): string {
  if (score >= 0.70) return 'bg-github-green-600';
  if (score >= 0.45) return 'bg-amber-500';
  return 'bg-gray-400';
}

/** Returns text color class for the score badge */
function getBadgeColorClass(score: number): string {
  if (score >= 0.70) return 'text-github-green-700';
  if (score >= 0.45) return 'text-amber-600';
  return 'text-gray-500';
}

export default function RelevanceIndicator({ score }: RelevanceIndicatorProps) {
  const percent = Math.round(score * 100);
  const barColor = getBarColorClass(score);
  const badgeColor = getBadgeColorClass(score);
  const widthPercent = Math.max(percent, 5); // minimum 5% width for visibility

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className={`text-[10px] font-medium tabular-nums ${badgeColor}`}>
        {percent}%
      </span>
    </div>
  );
}
