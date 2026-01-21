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
        setError('Failed to render diagram');
        setSvg(null);
      }
    };

    renderDiagram();
  }, [chart]);

  // Error fallback: show raw code
  if (error) {
    return (
      <div className="relative mb-4">
        <div className="absolute top-2 right-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded">
          Invalid Mermaid
        </div>
        <pre className="bg-gray-900 text-gray-100 py-3 px-4 rounded-lg overflow-x-auto text-sm font-mono">
          <code>{chart}</code>
        </pre>
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
