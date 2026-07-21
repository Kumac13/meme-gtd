import { useState, type ReactNode } from 'react';
import TemplateChooser, { type AppliedTemplate } from './TemplateChooser';

interface TemplateCreationFlowProps {
  target: 'task' | 'article';
  children: (initialValues: AppliedTemplate) => ReactNode;
}

/**
 * Owns the complete Blank／Template -> populated form transition.
 * Callers only render the resource-specific form and cannot reimplement
 * template loading or application.
 */
export default function TemplateCreationFlow({ target, children }: TemplateCreationFlowProps) {
  const [initialValues, setInitialValues] = useState<AppliedTemplate | null>(null);

  if (initialValues === null) {
    return <TemplateChooser target={target} onSelect={setInitialValues} />;
  }

  return children(initialValues);
}
