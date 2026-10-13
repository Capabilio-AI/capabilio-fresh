import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** One row of the settings hub: icon, title, one line of help, an optional status, and a chevron. The whole row is the link. */
export function SettingsLink({ href, icon: Icon, title, description, status }: { href: string; icon: LucideIcon; title: string; description: string; status?: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 border-b border-[var(--m-rule)]! px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--m-ground)] focus-visible:bg-[var(--m-ground)] sm:px-6"
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]">
        <Icon size={17} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-[var(--m-ink)]">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[var(--m-muted)]">{description}</span>
      </span>
      {status}
      <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--m-off)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12.5px] font-bold text-[var(--m-muted)]">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--m-rule)]! bg-[var(--m-sheet)]">{children}</div>
    </section>
  );
}
