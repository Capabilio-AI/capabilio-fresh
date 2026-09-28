import type { LucideIcon } from "lucide-react";

export function SettingsRow({
  icon: Icon,
  title,
  description,
  children,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-app-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === "warning" ? "bg-app-warning-container text-app-warning" : "bg-app-background text-app-charcoal"
          }`}
        >
          <Icon size={16} />
        </span>
        <div>
          <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{title}</p>
          {description && <p className="mt-0.5 font-lp-body text-[12px] text-app-muted">{description}</p>}
        </div>
      </div>
      {children && <div className="shrink-0 pl-12 sm:pl-0">{children}</div>}
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">{title}</h2>
      <div className="rounded-xl border border-app-border bg-white">{children}</div>
    </section>
  );
}
