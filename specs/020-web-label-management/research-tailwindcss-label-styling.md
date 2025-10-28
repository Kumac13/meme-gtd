# TailwindCSS Label/Tag Component Styling Research

**Date**: 2025-10-28
**Feature**: 020-web-label-management
**Research Focus**: Visual design patterns, dynamic styling, responsive design, and accessibility for label badge components

---

## Executive Summary

**Decision**: Use TailwindCSS with inline style attributes for dynamic HSL background colors, combined with utility classes for static styling (padding, border radius, typography). Generate accessible label colors using a deterministic hash function that converts label names to HSL values with controlled saturation and lightness ranges.

**Rationale**:
- TailwindCSS arbitrary values (`bg-[hsl(...)]`) require space-separated HSL syntax which conflicts with standard CSS syntax
- CSS custom properties add unnecessary complexity for component-scoped dynamic colors
- Inline styles provide the simplest, most performant solution for truly dynamic colors
- HSL color space allows easy adjustment of lightness for accessible contrast ratios
- Deterministic hashing ensures consistent colors for the same label across sessions and devices

---

## 1. Visual Design Patterns

### Industry Standard Components

Research of leading TailwindCSS component libraries reveals consistent patterns:

**Common Badge Anatomy**:
```tsx
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
  Label Text
</span>
```

**Key Design Elements**:
- **Shape**: Rounded rectangles (`rounded-md`) or pills (`rounded-full`)
- **Padding**: Small horizontal padding (8-12px / `px-2` to `px-3`)
- **Typography**: Small text size (12px / `text-xs`), medium weight (`font-medium`)
- **Display**: Inline-flex for proper alignment with text
- **Colors**: Background + contrasting text color

**Sizing Variants** (from Flowbite, Preline UI):
- **Small**: `text-xs px-2 py-0.5` (default for labels)
- **Medium**: `text-sm px-2.5 py-1`
- **Large**: `text-base px-3 py-1.5`

**Interactive States**:
- Hover: Slightly darker background (`hover:bg-opacity-80`)
- Focus: Ring outline for accessibility (`focus:ring-2 focus:ring-offset-1`)
- Disabled: Reduced opacity (`opacity-50 cursor-not-allowed`)

### Recommended Base Structure

```tsx
// Non-interactive label badge
<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium">
  Label
</span>

// Interactive label badge (clickable/removable)
<button
  type="button"
  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium
             hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400
             transition-opacity"
>
  Label
  <svg className="w-3 h-3" /* close icon */>...</svg>
</button>
```

---

## 2. Dynamic Styling Approaches

### Option A: TailwindCSS Arbitrary Values ❌ NOT RECOMMENDED

**Syntax**: `bg-[hsl(180_70%_80%)]`

**Pros**:
- Pure TailwindCSS approach
- Type-safe with proper IDE support

**Cons**:
- **CRITICAL**: Requires space-separated HSL syntax (`180 70% 80%`) instead of standard comma-separated (`180, 70%, 80%`)
- Breaks standard HSL color tools and mental models
- Difficult to read and maintain
- Must escape or remove spaces: `bg-[color:hsl(180,70%,80%)]` (non-standard)

**Example**:
```tsx
// Awkward syntax
<span className={`bg-[hsl(${h}_${s}%_${l}%)] text-gray-900`}>Label</span>
```

### Option B: CSS Custom Properties ❌ OVERLY COMPLEX

**Approach**: Define CSS variables in component and reference in Tailwind classes

**Example**:
```tsx
<span
  style={{
    '--label-h': h,
    '--label-s': `${s}%`,
    '--label-l': `${l}%`
  } as React.CSSProperties}
  className="bg-[hsl(var(--label-h)_var(--label-s)_var(--label-l))]"
>
  Label
</span>
```

**Cons**:
- Verbose and error-prone
- Still requires space-separated syntax for Tailwind
- No real benefit over inline styles
- Adds cognitive overhead

### Option C: Inline Styles + Tailwind Utilities ✅ RECOMMENDED

**Approach**: Use inline `style` attribute for dynamic colors, TailwindCSS classes for everything else

**Pros**:
- **Simple and direct**: Standard CSS syntax
- **Performant**: No CSS-in-JS runtime overhead
- **Maintainable**: Clear separation between dynamic (inline) and static (classes) styles
- **Type-safe**: TypeScript validates style objects
- **Standards-compliant**: Works with all HSL tools and color pickers

**Example**:
```tsx
<span
  style={{
    backgroundColor: `hsl(${h}, ${s}%, ${l}%)`,
    color: getTextColor(l) // Function returns 'white' or 'black'
  }}
  className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium"
>
  {label.name}
</span>
```

**Why This Works**:
1. Tailwind handles all static styling (spacing, typography, layout)
2. Inline styles handle only truly dynamic values (colors)
3. React efficiently handles inline style updates
4. No build-time or runtime compilation needed
5. Easy to test and debug

---

## 3. Color Generation Function

### Hash String to HSL

**Requirement**: Generate consistent, visually distinct, accessible colors from label names

**Algorithm**:
```typescript
/**
 * Generate a deterministic HSL color from a string
 * Ensures consistent colors across sessions and devices
 *
 * @param str - Label name to hash
 * @returns HSL values as [h, s, l] tuple
 */
export function stringToHSL(str: string): [number, number, number] {
  // 1. Hash the string to a consistent number
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // 2. Map hash to hue (0-360 degrees)
  const hue = Math.abs(hash % 360);

  // 3. Fixed saturation for vibrant but not overwhelming colors
  const saturation = 65; // 65% saturation (adjustable: 50-80% range)

  // 4. Fixed lightness for readability with dark text
  const lightness = 80; // 80% lightness (light background, dark text)

  return [hue, saturation, lightness];
}
```

**Rationale for Fixed S/L Values**:
- **Saturation 65%**: Vibrant enough to distinguish labels, not overwhelming
- **Lightness 80%**: Light background ensures good contrast with dark text
- **Variable Hue Only**: Provides maximum color variety while maintaining consistency

### Text Color Selection

**Requirement**: Ensure WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)

**Simple Approach** (sufficient for lightness > 70%):
```typescript
/**
 * Determine text color for given background lightness
 *
 * @param lightness - HSL lightness value (0-100)
 * @returns 'white' or 'black' for optimal contrast
 */
export function getTextColor(lightness: number): 'white' | 'black' {
  // For lightness > 65%, use dark text
  // For lightness < 65%, use white text
  return lightness > 65 ? 'black' : 'white';
}
```

**Advanced Approach** (for production with variable lightness):
```typescript
/**
 * Calculate relative luminance for WCAG contrast calculations
 * Based on WCAG 2.1 specification
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Convert HSL to RGB for luminance calculation
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}

/**
 * Get accessible text color with WCAG contrast validation
 */
export function getAccessibleTextColor(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  const bgLuminance = getLuminance(r, g, b);

  const whiteLuminance = 1; // Pure white
  const blackLuminance = 0; // Pure black

  const whiteContrast = getContrastRatio(whiteLuminance, bgLuminance);
  const blackContrast = getContrastRatio(blackLuminance, bgLuminance);

  // Prefer black text unless white has significantly better contrast
  return blackContrast >= 4.5 ? '#1f2937' : '#ffffff'; // gray-800 or white
}
```

**Recommended Libraries** (if not implementing manually):
- **color-hash**: Generates HSL colors from strings (5KB, no dependencies)
- **@hochleistungslabor/color-hasher**: Includes contrast ratio calculations
- **SafeColor**: WCAG 1.4.3 compliant color generation from strings

---

## 4. Responsive Design

### Label Overflow Handling

**Challenge**: Labels with long names or many labels on one item

**Solutions**:

```tsx
// Truncate long label names
<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium max-w-[200px]">
  <span className="truncate">{label.name}</span>
</span>

// Wrap multiple labels with gap spacing
<div className="flex flex-wrap gap-2">
  {labels.map(label => (
    <LabelBadge key={label.id} label={label} />
  ))}
</div>

// Show overflow count ("...and 3 more")
<div className="flex flex-wrap gap-2">
  {visibleLabels.map(label => (
    <LabelBadge key={label.id} label={label} />
  ))}
  {hiddenCount > 0 && (
    <span className="inline-flex items-center px-2.5 py-0.5 text-xs text-gray-500">
      +{hiddenCount} more
    </span>
  )}
</div>
```

### Mobile-Friendly Touch Targets

**WCAG 2.1 Success Criterion 2.5.5**: Target size at least 44x44 CSS pixels

```tsx
// Interactive labels (removable/clickable)
<button
  type="button"
  className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium
             min-h-[44px] min-w-[44px] /* WCAG touch target */
             hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1"
  style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
>
  {label.name}
  <svg className="w-4 h-4">...</svg>
</button>

// Non-interactive labels (display only)
<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium">
  {label.name}
</span>
```

### Responsive Label Lists

```tsx
// Mobile: Stack labels vertically with full width
// Desktop: Horizontal flow with wrapping
<div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
  {labels.map(label => (
    <LabelBadge key={label.id} label={label} />
  ))}
</div>
```

---

## 5. Accessibility Requirements

### Color Contrast (WCAG 2.1 Level AA)

**Requirements**:
- **Normal text** (< 18pt or < 14pt bold): Contrast ratio ≥ 4.5:1
- **Large text** (≥ 18pt or ≥ 14pt bold): Contrast ratio ≥ 3:1

**Implementation Strategy**:
1. Use fixed high lightness (80%) for light backgrounds
2. Always use dark text (`text-gray-800` or `text-gray-900`) on light backgrounds
3. Test with WebAIM Contrast Checker during development

**Testing**:
```bash
# Manual testing tools
https://webaim.org/resources/contrastchecker/
https://colourcontrast.cc/

# Automated testing (in E2E tests)
- Use @axe-core/playwright for accessibility testing
- Validate contrast ratios programmatically
```

### Visual Indicators Beyond Color

**WCAG 2.1 Success Criterion 1.4.1**: Don't rely on color alone to convey information

**Examples**:
```tsx
// Bad: Color-only distinction
<span className="bg-red-200">Error</span>
<span className="bg-green-200">Success</span>

// Good: Color + icon + text
<span className="bg-red-100 text-red-800 inline-flex items-center gap-1">
  <svg><!-- error icon --></svg>
  Error
</span>
<span className="bg-green-100 text-green-800 inline-flex items-center gap-1">
  <svg><!-- success icon --></svg>
  Success
</span>
```

**For Label Badges**:
- Label name is the primary identifier (not just color)
- Colors provide secondary visual distinction
- Consistent label names appear with consistent colors
- No critical information conveyed by color alone

### Focus Visible Styles

**WCAG 2.1 Success Criterion 2.4.7**: Keyboard users must see focus indicator

```tsx
// Interactive labels must have visible focus states
<button
  type="button"
  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium
             hover:opacity-80
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
             transition-all"
>
  Label
  <svg><!-- close icon --></svg>
</button>
```

**Key Focus Styles**:
- `focus:outline-none`: Remove default browser outline
- `focus:ring-2`: Add 2px ring around element
- `focus:ring-offset-2`: Add 2px gap between element and ring
- `focus:ring-gray-400`: Visible on both light and dark backgrounds
- `transition-all`: Smooth focus state transition

### Screen Reader Support

```tsx
// Removable label with accessible close button
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium">
  {label.name}
  <button
    type="button"
    onClick={() => onRemove(label.id)}
    aria-label={`Remove ${label.name} label`}
    className="hover:bg-black hover:bg-opacity-10 rounded p-0.5 focus:ring-2"
  >
    <svg className="w-3 h-3" aria-hidden="true">
      <!-- X icon -->
    </svg>
  </button>
</span>

// Label list with semantic HTML
<div role="list" aria-label="Applied labels">
  {labels.map(label => (
    <div key={label.id} role="listitem">
      <LabelBadge label={label} />
    </div>
  ))}
</div>
```

---

## 6. Complete LabelBadge Component Example

```tsx
import { useMemo } from 'react';

export interface Label {
  id: number;
  name: string;
  description?: string;
}

interface LabelBadgeProps {
  label: Label;
  onRemove?: (labelId: number) => void;
  size?: 'small' | 'medium';
}

/**
 * Generate deterministic HSL color from string
 */
function stringToHSL(str: string): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  const hue = Math.abs(hash % 360);
  const saturation = 65;
  const lightness = 80;

  return [hue, saturation, lightness];
}

/**
 * Get text color for given lightness
 */
function getTextColor(lightness: number): string {
  return lightness > 65 ? '#1f2937' : '#ffffff'; // gray-800 or white
}

export function LabelBadge({ label, onRemove, size = 'small' }: LabelBadgeProps) {
  const [h, s, l] = useMemo(() => stringToHSL(label.name), [label.name]);
  const textColor = useMemo(() => getTextColor(l), [l]);

  const sizeClasses = size === 'medium'
    ? 'text-sm px-2.5 py-1'
    : 'text-xs px-2.5 py-0.5';

  const commonStyle = {
    backgroundColor: `hsl(${h}, ${s}%, ${l}%)`,
    color: textColor,
  };

  if (onRemove) {
    // Interactive badge with remove button
    return (
      <span
        style={commonStyle}
        className={`inline-flex items-center gap-1 rounded-md font-medium ${sizeClasses}`}
      >
        <span className="truncate max-w-[150px]" title={label.name}>
          {label.name}
        </span>
        <button
          type="button"
          onClick={() => onRemove(label.id)}
          aria-label={`Remove ${label.name} label`}
          className="hover:bg-black hover:bg-opacity-10 rounded p-0.5
                     focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400
                     transition-all"
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
      </span>
    );
  }

  // Read-only badge
  return (
    <span
      style={commonStyle}
      className={`inline-flex items-center rounded-md font-medium ${sizeClasses}`}
      title={label.description || label.name}
    >
      <span className="truncate max-w-[150px]">
        {label.name}
      </span>
    </span>
  );
}
```

### Usage Examples

```tsx
// Display-only labels on a task card
<div className="flex flex-wrap gap-2">
  {task.labels.map(label => (
    <LabelBadge key={label.id} label={label} />
  ))}
</div>

// Interactive labels with removal
<div className="flex flex-wrap gap-2">
  {assignedLabels.map(label => (
    <LabelBadge
      key={label.id}
      label={label}
      onRemove={handleRemoveLabel}
      size="medium"
    />
  ))}
</div>

// Label in a list view (KanbanCard example)
<div className="space-y-2">
  <h3>{task.title}</h3>
  <div className="flex flex-wrap gap-1">
    {task.labels.map(label => (
      <LabelBadge key={label.id} label={label} size="small" />
    ))}
  </div>
</div>
```

---

## 7. Integration with Existing Components

### KanbanCard Integration

**File**: `/home/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/KanbanCard.tsx`

**Current Structure**:
- Type badge: `bg-blue-100 text-blue-700` (task) or `bg-purple-100 text-purple-700` (memo)
- Title with click navigation
- Draggable with `@dnd-kit/core`

**Proposed Addition**:
```tsx
import { LabelBadge } from './LabelBadge';

export default function KanbanCard({ item }: KanbanCardProps) {
  // ... existing code ...

  return (
    <div className="bg-white p-3 rounded border border-gray-200">
      {/* Existing header */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500">#{item.issueId}</span>
        <span className="text-xs px-2 py-0.5 rounded ...">
          {item.issue.type}
        </span>
      </div>

      {/* Title */}
      <div className="text-sm font-medium text-gray-900 mb-2">
        {item.issue.title}
      </div>

      {/* NEW: Labels */}
      {item.issue.labels && item.issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.issue.labels.slice(0, 3).map(label => (
            <LabelBadge key={label.id} label={label} size="small" />
          ))}
          {item.issue.labels.length > 3 && (
            <span className="text-xs text-gray-500">
              +{item.issue.labels.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

### ProjectsSection Pattern

**File**: `/home/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/web/src/components/ProjectsSection.tsx`

**Key Patterns to Reuse**:
1. **Dropdown with gear icon**: Same UI for label selector
2. **Search input**: Filter labels by name
3. **Checkbox list**: Select/deselect labels
4. **Recent section**: Show recently used labels
5. **Click-outside to close**: Same interaction pattern

**Consistent Styling**:
- Background: `bg-gray-50 border border-gray-200 rounded-lg p-4`
- Dropdown: `absolute top-full right-0 mt-2 w-80 bg-white border shadow-lg`
- Search: `px-3 py-2 border border-gray-300 rounded-md focus:ring-2`
- Checkboxes: `accentColor: '#16a34a'` (GitHub green)

---

## 8. Testing Recommendations

### Visual Regression Testing

```typescript
// packages/web/test/components/LabelBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabelBadge } from '../src/components/LabelBadge';

describe('LabelBadge', () => {
  it('generates consistent colors for same label name', () => {
    const label = { id: 1, name: 'bug' };
    const { rerender } = render(<LabelBadge label={label} />);
    const firstElement = screen.getByText('bug');
    const firstColor = firstElement.style.backgroundColor;

    rerender(<LabelBadge label={label} />);
    const secondElement = screen.getByText('bug');
    const secondColor = secondElement.style.backgroundColor;

    expect(firstColor).toBe(secondColor);
  });

  it('generates different colors for different labels', () => {
    const { rerender } = render(<LabelBadge label={{ id: 1, name: 'bug' }} />);
    const bugColor = screen.getByText('bug').style.backgroundColor;

    rerender(<LabelBadge label={{ id: 2, name: 'feature' }} />);
    const featureColor = screen.getByText('feature').style.backgroundColor;

    expect(bugColor).not.toBe(featureColor);
  });
});
```

### Accessibility Testing

```typescript
// packages/web/test/e2e/label-accessibility.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test('label badges meet WCAG AA contrast requirements', async ({ page }) => {
  await page.goto('/tasks/1');
  await injectAxe(page);

  // Check entire page for a11y violations
  await checkA11y(page, null, {
    rules: {
      'color-contrast': { enabled: true },
    },
  });
});

test('removable labels have accessible close buttons', async ({ page }) => {
  await page.goto('/tasks/1');

  // Find label close button by aria-label
  const closeButton = page.getByRole('button', { name: /Remove .* label/i });
  await expect(closeButton).toBeVisible();

  // Check focus visible
  await closeButton.focus();
  await expect(closeButton).toHaveCSS('outline', /.*ring.*/ );
});
```

---

## 9. Performance Considerations

### Memoization

```tsx
import { useMemo } from 'react';

export function LabelBadge({ label }: LabelBadgeProps) {
  // Only recalculate when label.name changes
  const [h, s, l] = useMemo(() => stringToHSL(label.name), [label.name]);
  const textColor = useMemo(() => getTextColor(l), [l]);

  // ... rest of component
}
```

### Virtualization for Large Lists

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function LabelSelector({ labels }: { labels: Label[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: labels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32, // Height of each label item
  });

  return (
    <div ref={parentRef} style={{ height: '300px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <LabelBadge label={labels[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**When to Use**:
- Only necessary if label count > 100
- Spec assumes typical count < 100, so not required for initial implementation

---

## 10. References

### Documentation
- [TailwindCSS Colors](https://tailwindcss.com/docs/colors)
- [TailwindCSS Customizing Colors](https://tailwindcss.com/docs/customizing-colors)
- [WCAG 2.1 Success Criteria](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Component Libraries
- [Flowbite Badges](https://flowbite.com/docs/components/badge/)
- [Preline UI Badge](https://preline.co/docs/badge.html)
- [Material Tailwind Chip](https://www.material-tailwind.com/docs/html/chip)

### Color Generation Libraries
- [color-hash](https://github.com/zenozeng/color-hash) - HSL color from string (5KB)
- [@hochleistungslabor/color-hasher](https://www.npmjs.com/package/@hochleistungslabor/color-hasher) - With contrast calculations
- [SafeColor](https://github.com/jessuni/SafeColor) - WCAG compliant color generation

### Tools
- [InclusiveColors](https://www.inclusivecolors.com/) - WCAG palette creator
- [Colour Contrast Checker](https://colourcontrast.cc/)
- [Contrast Finder](https://app.contrast-finder.org/) - Find accessible alternatives

---

## Appendix: Color Algorithm Comparison

### Simple Hash (Recommended for MVP)

```typescript
function stringToHSL(str: string): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return [Math.abs(hash % 360), 65, 80];
}
```

**Pros**: Simple, fast, no dependencies
**Cons**: Basic hash function, potential collisions

### BKDR Hash (from color-hash library)

```typescript
function bkdrHash(str: string): number {
  const seed = 131;
  const seed2 = 137;
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = hash * seed + str.charCodeAt(i);
  }

  return (hash & 0x7FFFFFFF) % seed2;
}
```

**Pros**: Better distribution, fewer collisions
**Cons**: Slightly more complex

### SHA-256 Hash (most robust)

```typescript
async function stringToHSLAsync(str: string): Promise<[number, number, number]> {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hue = hashArray[0] + (hashArray[1] << 8);
  return [hue % 360, 65, 80];
}
```

**Pros**: Cryptographically strong, minimal collisions
**Cons**: Async, overkill for label colors

**Recommendation**: Start with simple hash, upgrade to BKDR hash if collisions become an issue.
