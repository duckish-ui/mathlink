import katex from 'katex';
import { Fragment } from 'react';

// Matches $$display math$$ or $inline math$.
const MATH_PATTERN = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

function renderTex(tex: string, displayMode: boolean) {
  // KaTeX escapes everything it outputs and `trust` is off by default, so this is safe for user input.
  return katex.renderToString(tex, { displayMode, throwOnError: false });
}

/** Renders text that contains LaTeX between $…$ (inline) or $$…$$ (block). */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(MATH_PATTERN);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.length > 4 && part.startsWith('$$') && part.endsWith('$$')) {
          return (
            <span
              key={i}
              className="my-4 block overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: renderTex(part.slice(2, -2), true) }}
            />
          );
        }
        if (part.length > 2 && part.startsWith('$') && part.endsWith('$')) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(part.slice(1, -1), false) }} />;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}

/** A tiny markdown subset for lessons: `## headings`, `- bullets`, paragraphs and math. */
export function Lesson({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-4 leading-relaxed text-zinc-700 dark:text-zinc-300">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (block.startsWith('## ')) {
          const [heading, ...rest] = lines;
          return (
            <div key={i}>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{heading.slice(3)}</h3>
              {rest.length > 0 && <MathText text={rest.join('\n')} />}
            </div>
          );
        }
        if (lines.every((line) => line.startsWith('- '))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {lines.map((line, j) => (
                <li key={j}>
                  <MathText text={line.slice(2)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <MathText text={block} />
          </p>
        );
      })}
    </div>
  );
}
