import { Download } from "lucide-react";
import type { OrgCrtOverview, OrgCycle } from "@/lib/crt/org";
import { BAND_LABEL, CRT_MODULES, MODULE_LABEL, type Band } from "@/lib/crt/model";
import { bandFor } from "@/lib/crt/score";
import { JsonForm } from "./JsonForm";
import { Collapsible, EmptyState, Pill } from "./ui";
import { Fact, GroupTitle, Initial, Meter, Segmented } from "./widgets";

const SHOWN = 100;
const STATUS_PILL: Record<OrgCycle["status"], { tone: "ok" | "warn" | "neutral"; label: string }> = {
  open: { tone: "ok", label: "Open" },
  upcoming: { tone: "warn", label: "Upcoming" },
  closed: { tone: "neutral", label: "Closed" },
};
const BAND_TONE: Record<Band, "ok" | "warn" | "neutral"> = { strong: "ok", proficient: "ok", developing: "warn", needs_work: "neutral" };

const day = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/** The CRT tab of Outcomes: schedule a cycle, see who has taken it and how they did. */
export function CrtSection({ overview, canSchedule }: { overview: OrgCrtOverview; canSchedule: boolean }) {
  const { cycles, selected, suggested, branchOptions } = overview;
  const cycle = selected?.cycle;
  const s = cycle?.summary;

  return (
    <div className="flex flex-col gap-6">
      {canSchedule && (
        <Collapsible title="Schedule a CRT cycle" defaultOpen={cycles.length === 0}>
          <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">
            Students in scope receive the assessment only from the opening time you set. It has four modules and gives one minute per question. When it closes, the placement cell gets the results here and in notifications. Students are told before they start that you can see their score.
          </p>
          <JsonForm
            action="/api/org/crt"
            submitLabel="Schedule cycle"
            successMessage="Cycle scheduled."
            fields={[
              { name: "title", label: "Name", required: true, defaultValue: `CRT ${new Date(`${suggested.opensAt.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` },
              { name: "opensAt", label: "Opens at", type: "datetime-local", required: true, defaultValue: suggested.opensAt, help: "Students receive the assessment from this exact time, and not before." },
              { name: "closesAt", label: "Closes at", type: "datetime-local", required: true, defaultValue: suggested.closesAt, help: "Anyone who has started has one minute per question, up to this time." },
              { name: "branches", label: "Branches", type: "list", placeholder: branchOptions.slice(0, 3).map((b) => b.label).join(", ") || "CSE, ECE", help: "Comma-separated. Leave empty for every branch." },
              { name: "years", label: "Years of study", type: "list", placeholder: "3, 4", help: "Comma-separated. Leave empty for every year." },
            ]}
          />
        </Collapsible>
      )}

      {cycles.length === 0 ? (
        <EmptyState title="No CRT cycle yet" body={canSchedule ? "Schedule the first cycle above. A good rhythm is one every six months, near the start of each half of the academic year." : "The placement cell has not scheduled a CRT cycle yet."} />
      ) : (
        <>
          {cycles.length > 1 && <Segmented label="CRT cycles" tabs={cycles.map((c) => ({ label: c.title, href: `/org/outcomes?tab=crt&cycle=${c.id}`, active: c.id === cycle?.id }))} />}

          {cycle && s && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[18px] font-extrabold text-app-charcoal">{cycle.title}</h2>
                  <Pill tone={STATUS_PILL[cycle.status].tone}>{STATUS_PILL[cycle.status].label}</Pill>
                  <span className="text-[12.5px] text-app-muted">{day(cycle.opensAt)} to {day(cycle.closesAt)} · {cycle.durationMinutes} min</span>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={cycle.reportSent ? "ok" : "neutral"}>{cycle.reportSent ? "Results report sent" : "Report sends when the cycle closes"}</Pill>
                  <a href={`/api/org/crt/export?cycle=${cycle.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-[var(--o-pop)] px-3 py-2 font-lp-body text-[13px] font-medium text-app-charcoal hover:bg-white/5">
                    <Download size={14} aria-hidden /> Export CSV
                  </a>
                </div>
              </div>
              <p className="-mt-3 text-[12.5px] text-app-muted">
                Scope: {cycle.branches?.length ? cycle.branches.join(", ") : "every branch"} · {cycle.years?.length ? `year ${cycle.years.join(", ")}` : "every year"}
              </p>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Fact label="Students in scope" value={s.eligible} />
                <Fact label="Started" value={s.started} />
                <Fact label="Completed" value={s.submitted} tone="text-app-success" hint={`${s.participationPct}% of students in scope`} />
                <Fact label="Average score" value={s.avgPct !== null ? `${s.avgPct}%` : "—"} hint={s.avgPct !== null ? BAND_LABEL[bandFor(s.avgPct)] : "after the first result"} />
              </div>

              {s.submitted > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <section aria-label="Module averages">
                    <GroupTitle>Average by module</GroupTitle>
                    <ul className="o-card ws-rows overflow-hidden">
                      {CRT_MODULES.map((m) => (
                        <li key={m} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-40 shrink-0 truncate text-[13.5px] font-semibold text-app-charcoal">{MODULE_LABEL[m]}</span>
                          <span className="flex-1">{s.moduleAvg[m] !== null ? <Meter value={s.moduleAvg[m]!} max={100} label={MODULE_LABEL[m]} tone={s.moduleAvg[m]! >= 60 ? "ok" : "warn"} /> : null}</span>
                          <span className="w-12 text-right text-[13px] font-bold text-app-charcoal">{s.moduleAvg[m] !== null ? `${s.moduleAvg[m]}%` : "–"}</span>
                        </li>
                      ))}
                    </ul>
                    {s.weakest && <p className="mt-2 text-[12.5px] text-app-muted">Weakest area: <strong className="text-app-charcoal">{MODULE_LABEL[s.weakest]}</strong>. Plan training sessions here first.</p>}
                  </section>
                  <section aria-label="Score bands">
                    <GroupTitle>How students scored</GroupTitle>
                    <ul className="o-card ws-rows overflow-hidden">
                      {(["strong", "proficient", "developing", "needs_work"] as const).map((b) => (
                        <li key={b} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-28 shrink-0 text-[13.5px] font-semibold text-app-charcoal">{BAND_LABEL[b]}</span>
                          <span className="flex-1"><Meter value={s.bands[b]} max={Math.max(1, s.submitted)} label={BAND_LABEL[b]} tone={BAND_TONE[b] === "ok" ? "ok" : "warn"} /></span>
                          <span className="w-8 text-right text-[13px] font-bold text-app-charcoal">{s.bands[b]}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}

              {s.byBranch.length > 0 && (
                <section aria-label="By branch">
                  <GroupTitle>By branch</GroupTitle>
                  <ul className="o-card ws-rows overflow-hidden">
                    {s.byBranch.map((b) => (
                      <li key={b.branch} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-56 shrink-0 truncate text-[13.5px] font-semibold text-app-charcoal">{b.branch}</span>
                        <span className="flex-1">{b.avgPct !== null && <Meter value={b.avgPct} max={100} label={b.branch} tone={b.avgPct >= 60 ? "ok" : "warn"} />}</span>
                        <span className="w-24 text-right text-[12.5px] text-app-muted">{b.submitted} done · <strong className="text-app-charcoal">{b.avgPct}%</strong></span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-label="Student results">
                <GroupTitle count={selected!.rows.length}>Students</GroupTitle>
                {selected!.rows.length === 0 ? (
                  <EmptyState title="No students in scope" body="No active student matches this cycle's branches and years." />
                ) : (
                  <ul className="o-card ws-rows overflow-hidden">
                    {selected!.rows.slice(0, SHOWN).map((r) => (
                      <li key={r.userId} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                        <Initial text={r.name} size={42} />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-app-charcoal">{r.name}</p>
                          <p className="truncate text-[12.5px] text-app-muted">{[r.rollNumber, r.branch ?? "Branch not set"].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.totalPct !== null ? (
                            <>
                              <Pill tone={BAND_TONE[bandFor(r.totalPct)]}>{BAND_LABEL[bandFor(r.totalPct)]}</Pill>
                              <span className="w-12 text-right text-[14px] font-extrabold text-app-charcoal">{r.totalPct}%</span>
                            </>
                          ) : (
                            <Pill tone={r.started ? "warn" : "neutral"}>{r.started ? "In progress" : "Not started"}</Pill>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {selected!.rows.length > SHOWN && <p className="mt-2 text-[12.5px] text-app-muted">Showing the first {SHOWN} of {selected!.rows.length}. Export the CSV for everyone.</p>}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
