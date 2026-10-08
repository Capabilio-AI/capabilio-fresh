import Link from "next/link";
import type { ReactNode } from "react";

/** A round glass button that slides its label out on hover or focus; the label is always available to screen readers. */
export function DockButton({ href, label, children, badge }: { href: string; label: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group relative flex h-9 shrink-0 items-center rounded-full pl-[9px] pr-[9px] text-[var(--m-ink)] transition-[background-color,box-shadow,padding] duration-300 ease-out hover:bg-white hover:pr-4 hover:shadow-[0_4px_14px_-6px_rgba(20,20,20,0.35)] focus-visible:bg-white focus-visible:pr-4 motion-reduce:transition-none"
    >
      <span className="relative flex h-[20px] w-[20px] items-center justify-center">{children}{badge}</span>
      <span aria-hidden className="max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-bold opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-hover:ml-2 group-hover:max-w-[7rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[7rem] group-focus-visible:opacity-100 motion-reduce:transition-none">{label}</span>
    </Link>
  );
}
