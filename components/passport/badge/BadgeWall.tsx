"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, FolderGit2, GraduationCap, RotateCw, Swords, UserCheck, X } from "lucide-react";
import { BADGE_LEVELS, type BadgeEvidence, type PassportSkill } from "@/lib/passport/badges";
import { BadgeArt } from "./BadgeArt";
import { ago, engravedDate, shortDate } from "./format";
import { badgeTheme } from "./theme";
import "./badge.css";

export type Audience = "owner" | "public";

const TILT_DEGREES = 26;
const EVIDENCE_ICON = { ARENA: Swords, PROJECT: FolderGit2, GITHUB: BadgeCheck, MENTOR_EVALUATION: UserCheck } as const;
const KIND_LABEL: Record<string, string> = { ARENA: "Arena task", PROJECT: "Project", GITHUB: "GitHub", MENTOR_EVALUATION: "Mentor review", ASSESSMENT: "Assessment", LEARNING_MODULE: "Learning module", COURSE_PERFORMANCE: "Course", CERTIFICATION: "Certificate", SELF_DECLARED: "Self-declared" };

const tileMeta = (s: PassportSkill): string => {
  if (s.badge) return `${s.badge.level}${s.badge.provisional ? " · provisional" : ""} · ${s.badge.evidenceCount} ${s.badge.evidenceCount === 1 ? "task" : "pieces of work"}`;
  if (s.status === "practising") return s.next ? `${s.practiceCount} done · ${s.next.moreItems > 0 ? `${s.next.moreItems} more to go` : "keep going"}` : "In progress";
  if (s.status === "baseline") return `Starts at ${s.baselineLabel ?? "your assessment"} · do a task to earn it`;
  return "Not started";
};

function Tile({ skill, onOpen, compact = false }: { skill: PassportSkill; onOpen: () => void; compact?: boolean }) {
  const progress = skill.next ? Math.min(1, Math.max(skill.status === "practising" ? 0.12 : 0, (skill.practiceLevel ?? 0) / 100)) : 0;
  return (
    <li className={compact ? "w-[92px] shrink-0 snap-start" : undefined}>
      <button type="button" onClick={onOpen} aria-haspopup="dialog" className="bdg-tile flex w-full flex-col items-center gap-2 rounded-2xl p-2 text-center" aria-label={`${skill.name}, ${skill.badge ? `${skill.badge.level} badge` : "not earned yet"}. Open details.`}>
        <span className="bdg-tile-art block"><BadgeArt skillId={skill.skillId} name={skill.name} level={skill.badge?.level ?? null} size={compact ? 68 : 116} progress={progress} /></span>
        <span className={`font-lp-body font-bold leading-tight text-[var(--m-ink)] [text-wrap:balance] ${compact ? "line-clamp-2 text-[12px]" : "text-[13.5px]"}`}>{skill.name}</span>
        {compact ? skill.badge && <span className="font-lp-body text-[11px] text-[var(--m-muted)]">{skill.badge.level}</span> : <span className="font-lp-body text-[12px] leading-snug text-[var(--m-muted)]">{tileMeta(skill)}</span>}
      </button>
    </li>
  );
}

function Evidence({ e, audience }: { e: BadgeEvidence; audience: Audience }) {
  const Icon = EVIDENCE_ICON[e.kind as keyof typeof EVIDENCE_ICON] ?? GraduationCap;
  const title = e.label.replace(/^Arena: /, "");
  const when = shortDate(e.observedAt);
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--m-ground)]"><Icon size={16} aria-hidden className="text-[var(--m-ink)]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-lp-body text-[14px] font-bold leading-snug text-[var(--m-ink)]">{title}</span>
        <span className="block font-lp-body text-[12.5px] text-[var(--m-muted)]">{[KIND_LABEL[e.kind] ?? e.kind, when].filter(Boolean).join(" · ")}</span>
      </span>
      {e.score !== null && <span className="shrink-0 font-lp-display text-[15px] font-bold tabular-nums text-[var(--m-ink)]">{Math.round(e.score)}<span className="text-[11px] font-semibold text-[var(--m-muted)]">/100</span></span>}
      {audience === "owner" && e.link && <Link href={e.link} className="shrink-0 self-center font-lp-body text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline">View</Link>}
    </li>
  );
}

function Details({ skill, audience, practiseHref }: { skill: PassportSkill; audience: Audience; practiseHref: string }) {
  const b = skill.badge;
  const earned = shortDate(b?.earnedAt);
  const evidence = b ? b.evidence : skill.evidence.filter((e) => e.kind !== "ASSESSMENT");
  const last = ago(skill.lastWorkAt);
  return (
    <div className="bdg-body flex flex-col gap-5 p-5 sm:p-6">
      <header>
        <h2 id="bdg-title" className="font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">{skill.name}</h2>
        <p className="mt-1 font-lp-body text-[14px] text-[var(--m-muted)]">
          {b ? `${b.level} badge${earned ? ` · earned ${earned}` : ""}${b.provisional ? " · provisional until a second piece of work confirms it" : ""}` : skill.status === "practising" ? "Work started, not enough for a badge yet" : "Not earned yet"}
        </p>
      </header>

      {b && (
        <ol className="flex items-start" aria-label="How this badge grew">
          {BADGE_LEVELS.map((lvl, i) => {
            const reached = lvl in b.levelDates;
            const on = shortDate(b.levelDates[lvl]);
            return (
              <li key={lvl} className="relative flex-1">
                {i > 0 && <span aria-hidden className={`bdg-step-line absolute top-[9px] right-1/2 h-[3px] w-full rounded ${reached ? "" : "opacity-25"}`} />}
                <span aria-hidden className={`relative mx-auto block h-[21px] w-[21px] rounded-full border-[3px] ${reached ? "border-[var(--m-ink)] bg-[var(--bdg-a)]" : "border-[var(--m-rule)] bg-[var(--m-sheet)]"}`} />
                <span className={`mt-1.5 block text-center font-lp-body text-[12.5px] font-bold ${reached ? "text-[var(--m-ink)]" : "text-[var(--m-off)]"}`}>{lvl}</span>
                <span className="block text-center font-lp-body text-[11.5px] text-[var(--m-muted)]">{reached ? on ?? "date not recorded" : "not yet"}</span>
              </li>
            );
          })}
        </ol>
      )}

      {evidence.length > 0 ? (
        <section aria-labelledby="bdg-evidence">
          <h3 id="bdg-evidence" className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{audience === "public" ? "Work behind this badge" : "The work behind it"}</h3>
          <ul className="mt-1 divide-y divide-[var(--m-rule)]!">{evidence.map((e, i) => <Evidence key={`${e.label}-${i}`} e={e} audience={audience} />)}</ul>
          {evidence.some((e) => e.kind === "ARENA") && <p className="mt-2 font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">Arena tasks are graded automatically, then the learner explains their own approach in a short interview. A badge is never a typed-in claim.</p>}
          {last && <p className="mt-1 font-lp-body text-[12.5px] text-[var(--m-muted)]">Most recent work: {last}.</p>}
        </section>
      ) : (
        <p className="font-lp-body text-[14px] leading-relaxed text-[var(--m-muted)]">No demonstrated work yet. A badge is earned by doing the work, not by answering questions.</p>
      )}

      {audience === "owner" && (
        <section aria-labelledby="bdg-next" className="rounded-2xl bg-[var(--m-ground)] p-4">
          <h3 id="bdg-next" className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">{skill.next ? `To earn ${skill.next.level}` : "You hold the top badge for this skill"}</h3>
          {skill.next && (
            <p className="mt-1 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">
              {skill.next.moreItems > 0 ? `${skill.next.moreItems} more verified ${skill.next.moreItems === 1 ? "task" : "tasks"}` : "A little more verified work"}
              {skill.baselineLabel ? `. Your assessment placed you at ${skill.baselineLabel}: that is where you start, and it does not count towards a badge.` : "."}
            </p>
          )}
          {skill.next && <Link href={practiseHref} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13px] font-bold text-white! hover:opacity-90">Practise in Arena <ArrowRight size={14} aria-hidden /></Link>}
        </section>
      )}
    </div>
  );
}

function Viewer({ skills, index, onIndex, onClose, audience, practiseHref, startFlipped }: { skills: PassportSkill[]; index: number; onIndex: (i: number) => void; onClose: () => void; audience: Audience; practiseHref: string; startFlipped: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const object = useRef<HTMLDivElement>(null);
  // keyed by badge, so moving to another one shows its front without an effect to reset anything
  const [flip, setFlip] = useState({ index, on: startFlipped });
  const flipped = flip.index === index && flip.on;
  const toggleFlip = () => setFlip({ index, on: !flipped });
  const [tilting, setTilting] = useState(false);
  const skill = skills[index];
  const theme = useMemo(() => badgeTheme(skill.skillId, skill.name), [skill.skillId, skill.name]);
  const level = skill.badge?.level ?? null;

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = object.current;
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilting(true);
    el.style.setProperty("--ry", `${(x * TILT_DEGREES).toFixed(1)}deg`);
    el.style.setProperty("--rx", `${(-y * TILT_DEGREES).toFixed(1)}deg`);
    el.style.setProperty("--hx", `${(x * 90).toFixed(1)}`);
    el.style.setProperty("--hy", `${(y * 90).toFixed(1)}`);
    el.style.setProperty("--gx", `${(x * 70).toFixed(1)}`);
    el.style.setProperty("--gy", `${(y * 70).toFixed(1)}`);
  }, []);
  const rest = useCallback(() => {
    const el = object.current;
    setTilting(false);
    for (const v of ["--rx", "--ry", "--hx", "--hy", "--gx", "--gy"]) el?.style.removeProperty(v);
  }, []);

  const key = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowRight" && index < skills.length - 1) onIndex(index + 1);
    if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
  };
  const engraved = engravedDate(skill.badge?.earnedAt);

  return (
    <dialog ref={dialog} className="bdg-dialog" aria-labelledby="bdg-title" onClose={onClose} onKeyDown={key} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }} style={{ ["--bdg-a" as string]: theme.palette.a }}>
      <div className="bdg-sheet">
        <button type="button" className="bdg-close" onClick={() => dialog.current?.close()} aria-label="Close"><X size={18} aria-hidden /></button>
        <div className="bdg-stage">
          <button type="button" className="bdg-nav left-3" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Previous badge"><ChevronLeft size={20} aria-hidden /></button>
          <button type="button" className="bdg-nav right-3" onClick={() => onIndex(index + 1)} disabled={index === skills.length - 1} aria-label="Next badge"><ChevronRight size={20} aria-hidden /></button>
          <div ref={object} role="button" tabIndex={0} className={`bdg-object ${tilting ? "is-tilting" : ""}`} style={{ ["--flip" as string]: flipped && level ? 1 : 0 }} onPointerMove={move} onPointerLeave={rest} onClick={() => level && toggleFlip()} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && level) { e.preventDefault(); toggleFlip(); } }} aria-label={level ? `${skill.name} badge. Press to flip it ${flipped ? "back to the front" : "and see when it was earned"}.` : `${skill.name}, not earned yet`}>
            <span className="bdg-face"><BadgeArt skillId={skill.skillId} name={skill.name} level={level} size={250} progress={skill.practiceLevel ? skill.practiceLevel / 100 : 0} /></span>
            {level && <span className="bdg-face bdg-back"><BadgeArt skillId={skill.skillId} name={skill.name} level={level} face="back" size={250} engraved={engraved} /></span>}
          </div>
          {level && <button type="button" className="bdg-flip" onClick={toggleFlip}><RotateCw size={13} aria-hidden /> {flipped ? "Show front" : "Flip to see the date"}</button>}
          <p className="mt-2 font-lp-body text-[12px] text-[var(--m-muted)]" aria-live="polite">{index + 1} of {skills.length}</p>
        </div>
        <Details skill={skill} audience={audience} practiseHref={practiseHref} />
      </div>
    </dialog>
  );
}

export interface BadgeWallProps {
  skills: PassportSkill[];
  audience: Audience;
  /** where "practise" sends the owner */
  practiseHref?: string;
  /** open this skill's badge straight away (a shared link to one badge), optionally showing its back */
  defaultOpen?: string;
  defaultFlipped?: boolean;
  /** one small scrolling row of every skill, for a dashboard shelf; the popup is the same */
  compact?: boolean;
}

/**
 * Every skill as a collectible medallion. Tap one to hold it: it tilts with the pointer, flips to show the date it was earned, and lists the verified
 * work behind it. The public view shows only what was earned; the owner also sees what is next and why.
 */
export function BadgeWall({ skills, audience, practiseHref = "/arena/challenges/domain", defaultOpen, defaultFlipped = false, compact = false }: BadgeWallProps) {
  const earned = skills.filter((s) => s.badge);
  const next = skills.filter((s) => !s.badge);
  const viewable = audience === "public" ? earned : [...earned, ...next];
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  const index = open ? viewable.findIndex((s) => s.skillId === open) : -1;
  const [showAll, setShowAll] = useState(false);
  const shownNext = showAll ? next : next.slice(0, 8);

  const viewer = index >= 0 && <Viewer key="viewer" skills={viewable} index={index} onIndex={(i) => setOpen(viewable[i].skillId)} onClose={() => setOpen(null)} audience={audience} practiseHref={practiseHref} startFlipped={defaultFlipped} />;
  if (compact) {
    return (
      <div>
        <ul className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" aria-label="Skills, earned first">{viewable.map((s) => <Tile key={s.skillId} skill={s} compact onOpen={() => setOpen(s.skillId)} />)}</ul>
        {viewer}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="bdg-earned">
        <h3 id="bdg-earned" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Earned <span className="font-semibold text-[var(--m-muted)]">· {earned.length}</span></h3>
        {earned.length > 0 ? (
          <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">{earned.map((s) => <Tile key={s.skillId} skill={s} onOpen={() => setOpen(s.skillId)} />)}</ul>
        ) : (
          <p className="mt-2 max-w-[60ch] font-lp-body text-[14px] leading-relaxed text-[var(--m-muted)]">{audience === "public" ? "No badges earned yet." : "No badges yet, and that is honest: your assessment shows where you start, but a badge is earned by doing the work. Finish a verified task in Arena and your first badge appears here."}</p>
        )}
      </section>

      {audience === "owner" && next.length > 0 && (
        <section aria-labelledby="bdg-next-up">
          <h3 id="bdg-next-up" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Next up <span className="font-semibold text-[var(--m-muted)]">· {next.length}</span></h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">{shownNext.map((s) => <Tile key={s.skillId} skill={s} onOpen={() => setOpen(s.skillId)} />)}</ul>
          {next.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">{showAll ? "Show fewer" : `Show all ${next.length}`}</button>}
        </section>
      )}

      {viewer}
    </div>
  );
}
