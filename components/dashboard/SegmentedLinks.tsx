import Link from "next/link";
import clsx from "clsx";

export interface Segment {
  label: string;
  href: string;
  /** Short status shown beside the label, e.g. a count. */
  detail?: string;
  active: boolean;
}

/** Server-rendered view switch: each segment is a real URL, so views are linkable and back-button safe. */
export function SegmentedLinks({ label, segments }: { label: string; segments: Segment[] }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-xl border border-app-border bg-white p-1">
      {segments.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          scroll={false}
          aria-current={s.active ? "page" : undefined}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 font-lp-body text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40",
            s.active ? "bg-app-charcoal text-white" : "text-app-muted hover:bg-app-background hover:text-app-charcoal"
          )}
        >
          {s.label}
          {s.detail && (
            <span className={clsx("rounded-full px-1.5 py-0.5 font-lp-mono text-[10.5px]", s.active ? "bg-white/15 text-white" : "bg-app-background text-app-muted")}>
              {s.detail}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
