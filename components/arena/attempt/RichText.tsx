import type { ReactNode } from "react";

/** Inline `code` and **bold** only; everything else is plain text, so authored markdown can never inject markup. */
function inline(line: string): ReactNode[] {
  return line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i} className="rounded bg-app-border/50 px-1 font-lp-mono text-[0.92em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

/** Minimal renderer for ticket briefs: #/## headings, - lists, paragraphs. */
export function RichText({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`} className="ml-5 list-disc space-y-1">{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
    list = [];
  };
  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) {
      list.push(line.replace(/^\s*[-*] /, ""));
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) blocks.push(<h3 key={blocks.length} className="mt-3 font-lp-display text-[14px] font-semibold text-[var(--m-ink)] first:mt-0">{inline(h[2])}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-ink)]/85">{blocks}</div>;
}
