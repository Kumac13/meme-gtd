/**
 * Mermaid diagram rendering component
 * Renders Mermaid diagram code as SVG
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Mermaid initialization flag
let mermaidInitialized = false;

/**
 * Initialize Mermaid with secure settings
 */
function initializeMermaid() {
  if (mermaidInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
  });

  mermaidInitialized = true;
}

interface MermaidDiagramProps {
  /**
   * Mermaid diagram code
   */
  chart: string;
}

/**
 * Render Mermaid diagram from code
 * Shows error fallback with raw code if rendering fails
 */
export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    initializeMermaid();

    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        // Extract error message from Mermaid error
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
        setError(errorMessage);
        setSvg(null);
      }
    };

    renderDiagram();
  }, [chart]);

  // Error fallback: show raw code with error message below
  if (error) {
    return (
      <div className="mb-4">
        <pre className="bg-gray-900 text-gray-100 py-3 px-4 rounded-lg overflow-x-auto text-sm font-mono">
          <code>{chart}</code>
        </pre>
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-mono overflow-x-auto">
          <span className="font-bold">Invalid Mermaid:</span> {error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram mb-4 p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
