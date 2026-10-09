import { Fragment } from "react";

const CODEISH = /^\s*(select|with|insert|update|delete|create|alter|from|where|group by|order by|def |class |import |for |while |if |return |function |const |let |var |print\(|#include|\w+\s*=\s*.+|[\w.]+\([^)]*\);?)/i;

/** Heuristic only used to pick a monospace face for an option; never changes content. */
export const looksLikeCode = (text: string) => CODEISH.test(text) || /\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/.test(text) || (/[;{}]|=>|==/.test(text) && /[()=<>]/.test(text) && text.length < 400);

/** Renders question text, turning ``` fences and indented/SQL-looking blocks into a code panel. Text stays text (no HTML injection). */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/```(?:\w+)?\n?([\s\S]*?)```/g);
  return (
    <div className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="a-code my-3 overflow-x-auto rounded-xl bg-[var(--m-ink)] px-4 py-3 text-[13.5px] leading-relaxed text-white/95 shadow-inner">{part.trim()}</pre>
        ) : (
          <Fragment key={i}>{renderBlocks(part)}</Fragment>
        )
      )}
    </div>
  );
}

/** Question writers mark the phrase in question with *asterisks*; show it as an underlined phrase instead of stray symbols. */
function emphasis(text: string) {
  return text.split(/\*([^*\n]{1,80})\*/g).map((part, i) => (i % 2 === 1 ? <u key={i} className="decoration-[var(--m-accent)] decoration-2 underline-offset-4">{part}</u> : part));
}

function renderBlocks(text: string) {
  return text.split(/\n{2,}/).map((block, i) => {
    const lines = block.split("\n");
    const codeLines = lines.filter((l) => CODEISH.test(l)).length;
    const isCode = lines.length > 1 && codeLines / lines.length >= 0.6;
    return isCode ? (
      <pre key={i} className="a-code my-3 overflow-x-auto rounded-xl bg-[var(--m-ink)] px-4 py-3 text-[13.5px] leading-relaxed text-white/95 shadow-inner">{block.trim()}</pre>
    ) : (
      <p key={i} className="whitespace-pre-wrap [&:not(:first-child)]:mt-3">{emphasis(block)}</p>
    );
  });
}
