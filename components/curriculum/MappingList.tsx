"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { mappingChips, statusCounts } from "@/lib/curriculum/mapping-view";
import type { MappingView, SkillOption } from "@/lib/curriculum/admin-data";
import type { MappingImportance } from "@/lib/curriculum/mapping-rules";
import { Pill } from "@/components/org/ui";
import { api } from "./api";
import { SkillPicker } from "./SkillPicker";

interface Props {
  courseId: string;
  /** set for an outcome's own skills; absent for the course as a whole */
  outcomeId?: string;
  mappings: MappingView[];
  catalog: SkillOption[];
  editable: boolean;
  compact?: boolean;
}

const SOURCE: Record<MappingView["source"], string> = { AI_SUGGESTED: "AI suggested", COLLEGE_CONFIRMED: "Confirmed by your college", MANUAL: "Added by you", SYSTEM: "System" };
const STATUS_TONE = { CONFIRMED: "ok", SUGGESTED: "warn", REJECTED: "bad" } as const;
const STATUS_LABEL = { CONFIRMED: "Confirmed", SUGGESTED: "Suggested — needs review", REJECTED: "Rejected" } as const;

/**
 * Skills mapped to a course (or one of its outcomes). Everything shown is drawn straight from the stored rows passed in as props —
 * there is no local copy to drift from the database — and each action is a person's explicit decision sent to the server.
 */
export function MappingList({ courseId, outcomeId, mappings, catalog, editable, compact }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const chips = useMemo(() => mappingChips(mappings), [mappings]);
  const counts = statusCounts(mappings);
  const taken = useMemo(() => new Set(mappings.filter((m) => m.status === "CONFIRMED").map((m) => m.skillId)), [mappings]);
  const highlights = useMemo(() => new Map(mappings.filter((m) => m.status !== "CONFIRMED").map((m) => [m.skillId, m.status === "SUGGESTED" ? "AI suggested" : "Rejected earlier"])), [mappings]);

  async function decide(key: string, skillId: string, decision: "confirm" | "reject" | "clear", importance?: MappingImportance | null) {
    setBusy(key);
    setError(null);
    const r = await api("PUT", `/api/admin/curriculum/courses/${courseId}/mappings`, { decisions: [{ skillId, decision, ...(importance !== undefined ? { importance } : {}), ...(outcomeId ? { outcomeId } : {}) }] });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div>
      <p className="font-lp-mono text-[11px] text-app-muted" role="status">
        {counts.total === 0 ? "No skills yet" : `${counts.confirmed} confirmed · ${counts.suggested} suggested · ${counts.rejected} rejected`}
      </p>
      {chips.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {chips.map((m) => (
            <li key={m.id} className="rounded-xl border border-app-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-lp-body text-[13px] font-semibold text-app-charcoal">{m.skillName}</span>
                <span className="font-lp-mono text-[10.5px] text-app-muted">{m.category}</span>
                <Pill tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Pill>
                <span className="font-lp-mono text-[10.5px] text-app-muted">{SOURCE[m.source]}{m.confidence != null ? ` · ${Math.round(m.confidence * 100)}% confidence` : ""}</span>
              </div>
              {m.evidence && !compact && <p className="mt-1.5 font-lp-body text-[12px] leading-relaxed text-app-muted">“{m.evidence}”</p>}
              {editable && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.status !== "CONFIRMED" && (
                    <button type="button" className="o-btn !px-3 !py-1.5 !text-[12px]" disabled={busy !== null} onClick={() => decide(`c-${m.id}`, m.skillId, "confirm")}>
                      {busy === `c-${m.id}` ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />} Confirm
                    </button>
                  )}
                  {m.status !== "REJECTED" && (
                    <button type="button" className="o-btn-ghost !px-3 !py-1.5 !text-[12px]" disabled={busy !== null} onClick={() => decide(`r-${m.id}`, m.skillId, "reject")}>
                      {busy === `r-${m.id}` ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <X size={12} aria-hidden="true" />} Reject
                    </button>
                  )}
                  {m.status === "CONFIRMED" && !outcomeId && (
                    <label className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
                      Importance
                      <select className="o-input !w-auto !py-1 !text-[12px]" value={m.importance ?? ""} disabled={busy !== null} onChange={(e) => decide(`i-${m.id}`, m.skillId, "confirm", (e.target.value || null) as MappingImportance | null)}>
                        <option value="">Not set</option>
                        <option value="CORE">Core</option>
                        <option value="SUPPORTING">Supporting</option>
                        <option value="MINOR">Minor</option>
                      </select>
                    </label>
                  )}
                  <button type="button" className="ml-auto text-app-muted hover:text-app-charcoal disabled:opacity-50" aria-label={`Remove ${m.skillName}`} disabled={busy !== null} onClick={() => decide(`x-${m.id}`, m.skillId, "clear")}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="mt-3">
          <button type="button" className="o-btn-ghost !px-3 !py-1.5 !text-[12px]" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            <Plus size={12} aria-hidden="true" /> {adding ? "Close skill list" : "Add a skill"}
          </button>
          {adding && (
            <div className="mt-2">
              <SkillPicker catalog={catalog} taken={taken} highlights={highlights} disabled={busy !== null} onPick={(s) => void decide(`a-${s.id}`, s.id, "confirm")} />
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 font-lp-body text-[12px] text-app-rose" role="alert">{error}</p>}
    </div>
  );
}
