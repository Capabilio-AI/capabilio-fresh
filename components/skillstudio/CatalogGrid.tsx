import { CheckCircle2, Circle } from "lucide-react";

export interface CatalogCardItem {
  id: string;
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  skills: string[];
  description?: string;
  meta?: string;
  matchesGap: boolean;
}

const LEVEL_COLOR: Record<CatalogCardItem["level"], string> = {
  Beginner: "bg-app-success-container text-app-success",
  Intermediate: "bg-app-warning-container text-app-warning",
  Advanced: "bg-app-attention-container text-app-attention",
};

export function CatalogGrid({ items }: { items: CatalogCardItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
        <p className="font-lp-body text-[13.5px] text-app-muted">Nothing in this catalog yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="flex h-full flex-col gap-2.5 rounded-xl border border-[var(--m-rule)] bg-white p-4 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_8px_20px_-8px_rgba(20,20,20,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-lp-display text-[17px] font-bold leading-snug text-[var(--m-ink)]">{item.title}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${LEVEL_COLOR[item.level]}`}>
              {item.level}
            </span>
          </div>
          {item.description && <p className="font-lp-body text-[12.5px] leading-relaxed text-app-muted">{item.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            {item.skills.map((s) => (
              <span key={s} className="rounded-full bg-[var(--m-ground)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--m-ink)]">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <span className="flex min-w-0 items-center gap-1.5 font-lp-mono text-[10.5px] text-app-muted">
              {item.matchesGap ? (
                <>
                  <CheckCircle2 size={13} className="shrink-0 text-app-orange" />
                  <span className="truncate text-app-orange">Matches your skill gap</span>
                </>
              ) : item.meta ? (
                <>
                  <Circle size={13} className="shrink-0" />
                  <span className="truncate">{item.meta}</span>
                </>
              ) : null}
            </span>
            <button
              type="button"
              className="rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal transition-colors hover:bg-app-background"
            >
              Start
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
