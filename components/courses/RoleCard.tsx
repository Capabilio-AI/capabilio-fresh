import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** One job role: what it is, how many topics its path has, and one button to see the path. */
export function RoleCard({ roleKey, name, blurb, topics, note }: { roleKey: string; name: string; blurb?: string | null; topics: number; note?: string }) {
  return (
    <li>
      <Link href={`/skillstudio/courses/role/${roleKey}`} className="group flex h-full flex-col gap-2 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-colors hover:border-[var(--m-ink)] focus-visible:border-[var(--m-ink)]">
        <span className="font-lp-display text-[20px] font-bold leading-tight text-[var(--m-ink)]">{name}</span>
        {blurb && <span className="line-clamp-3 text-[14.5px] leading-snug text-[var(--m-muted)]">{blurb}</span>}
        {note && <span className="text-[13.5px] leading-snug text-[var(--m-ink)]">{note}</span>}
        <span className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="ss-num text-[13px] font-bold text-[var(--m-muted)]">{topics} topics</span>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--m-accent-ink)]">See the path<ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
        </span>
      </Link>
    </li>
  );
}
