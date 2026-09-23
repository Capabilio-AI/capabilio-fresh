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
        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-app-border bg-white p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-lp-body text-[14.5px] font-semibold text-app-charcoal">{item.title}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${LEVEL_COLOR[item.level]}`}>
              {item.level}
            </span>
          </div>
          {item.description && <p className="font-lp-body text-[12.5px] leading-relaxed text-app-muted">{item.description}</p>}
          <div className="flex flex-wrap gap-1.5">
            {item.skills.map((s) => (
              <span key={s} className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10.5px] text-app-muted">
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
