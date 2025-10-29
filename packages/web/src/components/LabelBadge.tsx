interface LabelBadgeProps {
  name: string;
  onRemove?: () => void;
  className?: string;
}

/**
 * Generate a consistent color for a label based on its name
 * Uses HSL color space with fixed saturation and lightness for visual consistency
 */
export function getLabelColor(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  // Use lighter background with darker text for better contrast (WCAG AA compliance)
  const bgColor = `hsl(${hue}, 70%, 85%)`;
  const textColor = `hsl(${hue}, 60%, 25%)`;

  return { bg: bgColor, text: textColor };
}

/**
 * LabelBadge - Display a label with auto-generated color
 *
 * Features:
 * - Deterministic color generation from label name
 * - Optional remove button for interactive contexts
 * - Accessible with proper ARIA attributes
 * - Consistent styling across the application
 */
export function LabelBadge({ name, onRemove, className = '' }: LabelBadgeProps) {
  const colors = getLabelColor(name);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      <span>{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 focus:outline-none focus:ring-1 focus:ring-offset-1"
          aria-label={`Remove ${name} label`}
          type="button"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
