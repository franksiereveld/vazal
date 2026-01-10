import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders text with LaTeX math expressions
 * Supports both inline \(...\) and display \[...\] math
 */
export function LatexRenderer({ content, className = '' }: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Replace LaTeX expressions with rendered HTML
    let html = content;

    // Display math: \[...\]
    html = html.replace(/\\\[(.*?)\\\]/g, (match, math) => {
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    // Inline math: \(...\)
    html = html.replace(/\\\((.*?)\\\)/g, (match, math) => {
      try {
        return katex.renderToString(math, { displayMode: false, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    containerRef.current.innerHTML = html;
  }, [content]);

  return <div ref={containerRef} className={className} />;
}
