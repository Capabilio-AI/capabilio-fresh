"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Loader2, Trash2 } from "lucide-react";
import { fmtExperience } from "@/lib/professional/experience";
import { radarSkills } from "@/lib/professional/radar";
import { RadarChart } from "@/components/professional/home/RadarChart";
import { CATEGORIES, LEVELS, LEVEL_LABEL, groupSkills, monthsFor, sizeOf, validateSkill, type ProSkill, type Size, type SkillLevel } from "@/lib/professional/skills";
import { periodOf, type ProEmploymentRow } from "@/lib/professional/work";

const TILE: Record<SkillLevel, string> = { learning: "border-dashed border-[var(--m-muted)] bg-white text-[var(--m-muted)]", working: "border-transparent bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]", expert: "border-transparent bg-[var(--m-ink)] text-white" };
const SIZE: Record<Size, string> = { small: "px-3 py-1.5 text-[13px]", medium: "px-4 py-2 text-[14.5px]", large: "px-5 py-2.5 text-[16px]" };
const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/** The skill graph: skills grouped by area. A bigger tile means more months in the jobs it is linked to; the fill shows how well you know it. */
export function SkillGraph({ skills, jobs }: { skills: ProSkill[]; jobs: ProEmploymentRow[] }) {
  const id = useId();
  const router = useRouter();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = skills.find((s) => s.id === pickedId) ?? null;
  const [draft, setDraft] = useState({ name: "", category: "Engineering", level: "working" as SkillLevel, jobIds: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const groups = groupSkills(skills);
  const now = new Date();
  const spokes = radarSkills(skills, jobs, now);

  const open = (s: ProSkill | null) => {
    setPickedId(s?.id ?? null);
    setDraft(s ? { name: s.name, category: s.category, level: s.level, jobIds: s.jobIds } : { name: "", category: "Engineering", level: "working", jobIds: [] });
    setMsg(null);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateSkill(draft);
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    const err = await send(picked ? `/api/professional/skills/${picked.id}` : "/api/professional/skills", picked ? "PUT" : "POST", check.value);
    setBusy(false);
    if (err) return setMsg(err);
    if (!picked) open(null);
    setMsg("Saved.");
    router.refresh();
  };
  const remove = async () => {
    if (!picked) return;
    setBusy(true);
    const err = await send(`/api/professional/skills/${picked.id}`, "DELETE");
    setBusy(false);
    if (err) return setMsg(err);
    open(null);
    router.refresh();
  };
  const toggleJob = (jobId: string) => setDraft((d) => ({ ...d, jobIds: d.jobIds.includes(jobId) ? d.jobIds.filter((j) => j !== jobId) : [...d.jobIds, jobId] }));

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby={`${id}-r`} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7">
        <h2 id={`${id}-r`} className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Skill radar</h2>
        {spokes.length >= 3 ? (
          <div className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
            <RadarChart spokes={spokes} />
            <div>
              <p className="text-[14px] leading-relaxed text-[var(--m-muted)]">Your {spokes.length} strongest skills. The further a point is from the centre, the better you know the skill and the longer you have used it in your jobs. Link a skill to a job below to push it outwards.</p>
              <ol aria-label="Strongest skills" className="mt-4 grid gap-2 sm:grid-cols-2">{spokes.map((s, n) => <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--m-ground)] px-3.5 py-2 text-[13.5px]"><span className="font-bold text-[var(--m-ink)]">{n + 1}. {s.name}</span><span className="tabular-nums text-[var(--m-muted)]">{Math.round(s.value * 100)}</span></li>)}</ol>
            </div>
          </div>
        ) : <p className="mt-2 text-[14.5px] text-[var(--m-muted)]">{skills.length === 0 ? "No skills yet. Add your first below, or upload your resume on the Overview page." : "Add at least three skills to see your radar."}</p>}
      </section>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby={`${id}-h`} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7">
        <h2 id={`${id}-h`} className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Your skill graph</h2>
        <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">Link a skill to the jobs you used it in and its tile grows with the time you spent on it.</p>
        <ul aria-label="How to read the tiles" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[var(--m-muted)]">
          {LEVELS.slice().reverse().map((l) => <li key={l} className="flex items-center gap-2"><span aria-hidden className={clsx("h-4 w-7 rounded-full border", TILE[l])} />{LEVEL_LABEL[l]}</li>)}
        </ul>
        {groups.length === 0 ? <p className="mt-6 text-[14.5px] text-[var(--m-muted)]">No skills yet. Add your first on the right, or upload your resume on the Overview page and they are read from it.</p> : (
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.category}>
                <h3 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{g.category}</h3>
                <ul className="mt-2.5 flex flex-wrap items-center gap-2">
                  {g.skills.map((s) => (
                    <li key={s.id}><button type="button" aria-pressed={s.id === pickedId} onClick={() => open(s)} className={clsx("rounded-full border font-bold transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)]", TILE[s.level], SIZE[sizeOf(monthsFor(s, jobs, now))], s.id === pickedId && "ring-2 ring-[var(--m-accent)] ring-offset-2")}>{s.name}<span className="sr-only"> ({LEVEL_LABEL[s.level]})</span></button></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={save} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 lg:sticky lg:top-28" aria-label={picked ? `Edit ${picked.name}` : "Add a skill"}>
        <h2 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{picked ? picked.name : "Add a skill"}</h2>
        {picked && <p className="mt-1 text-[13px] text-[var(--m-muted)]">{monthsFor(picked, jobs, now) > 0 ? `${fmtExperience(monthsFor(picked, jobs, now))} in linked jobs` : "Not linked to a job yet"}{picked.source === "resume" ? " · from your resume" : ""}</p>}
        <div className="mt-4 grid gap-4">
          <div><label htmlFor={`${id}-n`} className={LABEL}>Skill</label><input id={`${id}-n`} className={FIELD} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Apache Kafka" /></div>
          <div><label htmlFor={`${id}-c`} className={LABEL}>Area</label><input id={`${id}-c`} list={`${id}-cats`} className={FIELD} value={draft.category} maxLength={40} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /><datalist id={`${id}-cats`}>{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></div>
          <fieldset><legend className={LABEL}>How well do you know it?</legend><div className="flex flex-wrap gap-2">{LEVELS.map((l) => <label key={l} className={clsx("cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--m-accent)]", draft.level === l ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] text-[var(--m-muted)]")}><input type="radio" name={`${id}-lvl`} value={l} checked={draft.level === l} onChange={() => setDraft({ ...draft, level: l })} className="sr-only" />{LEVEL_LABEL[l]}</label>)}</div></fieldset>
          {jobs.length > 0 && (
            <fieldset><legend className={LABEL}>Used in these jobs</legend><ul className="grid gap-1.5">{jobs.map((j) => <li key={j.id}><label className="flex items-start gap-2 text-[13.5px] text-[var(--m-ink)]"><input type="checkbox" checked={draft.jobIds.includes(j.id)} onChange={() => toggleJob(j.id)} className="mt-0.5 size-4 accent-[var(--m-ink)]" /><span>{j.job_title}, {j.employer_name}<span className="block text-[12px] text-[var(--m-muted)]">{j.start_date ? periodOf(j.start_date, j.end_date) : (j.period_text ?? "Dates not added")}</span></span></label></li>)}</ul></fieldset>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}{picked ? "Save changes" : "Add skill"}</button>
          {picked && <><button type="button" onClick={() => open(null)} className="text-[13.5px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">New skill</button><button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${picked.name}`} className="ml-auto grid size-9 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)]"><Trash2 size={16} aria-hidden /></button></>}
        </div>
        <p role="status" className="mt-3 min-h-[1.25rem] text-[13px] text-[var(--m-muted)]">{msg}</p>
      </form>
    </div>
    </div>
  );
}
