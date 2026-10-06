"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { groupCatalog } from "@/lib/curriculum/mapping-view";
import type { SkillOption } from "@/lib/curriculum/admin-data";

interface Props {
  catalog: SkillOption[];
  /** skills that are already confirmed here — not offered again */
  taken: ReadonlySet<string>;
  /** skill id -> why it is highlighted ("AI suggested" or "Rejected earlier") */
  highlights: ReadonlyMap<string, string>;
  disabled?: boolean;
  onPick: (skill: SkillOption) => void;
}

/** Searchable catalog grouped by category. Skills the AI suggested for this course come first and are marked. */
export function SkillPicker({ catalog, taken, highlights, disabled, onPick }: Props) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const groups = useMemo(
    () =>
      groupCatalog(catalog, query, taken).map((g) => ({
        ...g,
        skills: [...g.skills].sort((a, b) => Number(highlights.has(b.id)) - Number(highlights.has(a.id)) || a.name.localeCompare(b.name)),
      })),
    [catalog, query, taken, highlights]
  );
  const total = groups.reduce((n, g) => n + g.skills.length, 0);

  return (
    <div className="rounded-xl border border-app-border p-3">
      <label htmlFor={inputId} className="sr-only">Search the skill catalog</label>
      <div className="relative">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
        <input id={inputId} className="o-input !pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills, e.g. SQL, graphs, testing" autoComplete="off" />
      </div>
      <p className="mt-2 font-lp-mono text-[11px] text-app-muted" role="status" aria-live="polite">{total} skill{total === 1 ? "" : "s"}{query.trim() ? ` match “${query.trim()}”` : " in the catalog"}</p>
      <div className="mt-2 max-h-64 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="py-3 font-lp-body text-[12.5px] text-app-muted">No skill matches. Skills come from the Capabilio catalog — if one is missing, it can be added there; we never create skills automatically.</p>
        ) : (
          groups.map((g) => (
            <div key={g.category} className="mb-3">
              <h4 className="o-eyebrow mb-1.5">{g.category}</h4>
              <div className="flex flex-wrap gap-1.5">
                {g.skills.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    title={s.description ?? undefined}
                    onClick={() => onPick(s)}
                    className={`rounded-full border px-2.5 py-1 font-lp-body text-[12px] transition-colors disabled:opacity-50 ${highlights.has(s.id) ? "border-app-orange bg-app-orange-container text-app-charcoal" : "border-app-border text-app-charcoal hover:border-[var(--o-line-strong)]"}`}
                  >
                    {s.name}
                    {highlights.has(s.id) && <span className="ml-1.5 font-lp-mono text-[10px] text-app-orange">{highlights.get(s.id)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
