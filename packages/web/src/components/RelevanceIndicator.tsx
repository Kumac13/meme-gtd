/**
 * Subtle text indicator for semantic search relevance score.
 */

interface RelevanceIndicatorProps {
  /** Cosine similarity score (0-1) */
  score: number;
}

function getBadgeColorClass(score: number): string {
  if (score >= 0.70) return 'text-github-green-700';
  if (score >= 0.45) return 'text-amber-600';
  return 'text-gray-400';
}

export default function RelevanceIndicator({ score }: RelevanceIndicatorProps) {
  const percent = Math.round(score * 100);
  const badgeColor = getBadgeColorClass(score);

  return (
    <span className={`text-[10px] font-medium tabular-nums ${badgeColor}`}>
      {percent}% match
    </span>
  );
}
