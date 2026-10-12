import type { ReactNode } from "react";

export default function Window({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`cap-win overflow-hidden rounded-2xl bg-white text-cap-ink ${className}`}>
      <div className="flex items-center justify-between border-b border-cap-line! bg-cap-mist px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="rounded-full bg-cap-ink px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-cap-paper">
          Sample data
        </span>
      </div>
      {children}
    </div>
  );
}
