"use client";

import { GoalBox } from "@/components/pathways/GoalBox";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import clsx from "clsx";
import type { RoleOption } from "@/lib/assess/roles";
import { filterRoles, roleBlurb } from "@/lib/assess/role-filter";
import { ChooseRoleButton } from "./ChooseRoleButton";

const SHOWN = 12;
const IMPORTANCE_LABEL = { CRITICAL: "Must have", HIGH: "Important", MEDIUM: "Helpful", LOW: "Bonus" } as const;

/**
 * Plain-language role cards for a student who has not chosen yet. Nothing here is a recommendation or a score: it only says what a role
 * is about and which skills it needs, taken from the role's own skill list, so a first-year can compare roles without knowing any jargon.
 */
export interface StreamView { label: string; branch: string | null; known: boolean; suggested: RoleOption[]; extra: { name: string; blurb: string }[] }

export function ExploreRoles({ roles, required, stream }: { roles: RoleOption[]; required: boolean; stream: StreamView }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const hits = useMemo(() => filterRoles(roles, text), [roles, text]);
  const shown = text.trim() || all ? hits : hits.slice(0, SHOWN);

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-[62ch]">
        <p className="font-lp-body text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--m-accent-ink)]">Explore roles</p>
        <h1 className="mt-1 font-lp-display text-[28px] font-bold leading-tight text-[var(--m-ink)] sm:text-[34px]">
          {required ? "Pick the role you want to grow into" : "Not sure what you want to become? Look around first."}
        </h1>
        <p className="mt-2 font-lp-body text-[15px] leading-relaxed text-app-muted">
          {required
            ? "From 3rd year, Capabilio needs a role to build your skill graph, challenges and roadmap. Open a few roles, read the skills they need, and pick the one that fits. You can change it later."
            : "Nobody expects you to know yet. Open any role to see the skills it needs. If a few of them already sound like you, that is a good sign. Choosing a role is optional until 3rd year."}
        </p>
      </header>

      <GoalBox heading="Your goal is not a job role?" />

      <label className="relative block max-w-md">
        <span className="sr-only">Search roles</span>
        <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--m-muted)]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search: data, software, testing, design..."
          className="w-full rounded-full border border-[var(--m-rule)] bg-white py-3 pl-10 pr-4 font-lp-body text-[15px] text-[var(--m-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]"
        />
      </label>

      {shown.length === 0 && <p className="font-lp-body text-[14px] text-app-muted">No role matches &ldquo;{text.trim()}&rdquo;. Try a shorter word, or choose a role in the assessment by typing any role name.</p>}

      {!text.trim() && stream.suggested.length > 0 && (
        <section aria-labelledby="fit-h" className="flex flex-col gap-3">
          <div>
            <h2 id="fit-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{stream.known ? `Roles that fit ${stream.label}` : "Good roles to start looking at"}</h2>
            <p className="font-lp-body text-[13.5px] text-app-muted">{stream.known ? "Chosen for your branch. Many of these also hire from other branches." : stream.branch ? `We have no special list for ${stream.branch} yet. These roles take people from any branch.` : "These roles take people from any branch."}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stream.suggested.map((role) => <RoleCard key={role.careerId} role={role} open={open} setOpen={setOpen} />)}
          </ul>
          {stream.extra.length > 0 && (
            <>
              <p className="mt-2 font-lp-body text-[13px] font-bold uppercase tracking-wide text-[var(--m-muted)]">More {stream.label} roles to explore</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {stream.extra.map((x) => (
                  <li key={x.name} className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-4">
                    <div>
                      <p className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{x.name}</p>
                      <p className="mt-1 font-lp-body text-[13.5px] leading-snug text-app-muted">{x.blurb}</p>
                    </div>
                    <p className="font-lp-body text-[12px] text-[var(--m-muted)]">Choose it and Capabilio builds your skill plan for this role.</p>
                    <ChooseRoleButton name={x.name} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <h2 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{text.trim() ? "Search results" : "All roles"}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map(({ role }) => <RoleCard key={role.careerId} role={role} open={open} setOpen={setOpen} />)}
      </ul>

      {!text.trim() && !all && hits.length > SHOWN && (
        <button type="button" onClick={() => setAll(true)} className="self-start rounded-full border border-[var(--m-rule)] bg-white px-5 py-2.5 text-[14px] font-bold text-[var(--m-ink)]">
          Show all {hits.length} roles
        </button>
      )}
    </div>
  );
}

function RoleCard({ role, open, setOpen }: { role: RoleOption; open: string | null; setOpen: (id: string | null) => void }) {
  const isOpen = open === role.careerId;
  const blurb = roleBlurb(role.description);
  const top = role.skills.slice(0, 4);
  return (
    <li className={clsx("flex flex-col rounded-2xl border bg-white transition-shadow", isOpen ? "border-[var(--m-accent)] shadow-md sm:col-span-2 xl:col-span-1" : "border-[var(--m-rule)]")}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : role.careerId)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
                <span className="min-w-0">
                  <span className="block font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{role.name}</span>
                  {blurb && <span className="mt-1 block font-lp-body text-[13.5px] leading-snug text-app-muted">{blurb}</span>}
                </span>
                <ChevronDown size={18} aria-hidden className={clsx("mt-1 shrink-0 text-[var(--m-muted)] transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="border-t border-[var(--m-rule)] p-4">
                  <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Skills this role needs</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {role.skills.slice(0, 8).map((s) => (
                      <li key={s.name} className="flex items-center justify-between gap-3 font-lp-body text-[14px] text-[var(--m-ink)]">
                        <span>{s.name}</span>
                        <span className="shrink-0 rounded-full bg-[var(--m-accent-soft)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--m-accent-ink)]">{IMPORTANCE_LABEL[s.importance]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 font-lp-body text-[13px] leading-relaxed text-app-muted">You do not need to know these today. Capabilio tests where you stand and then teaches the gaps.</p>
                  <ChooseRoleButton name={role.name} careerId={role.careerId} solid />
                </div>
              )}
              {!isOpen && top.length > 0 && <p className="px-4 pb-4 font-lp-body text-[12.5px] text-[var(--m-muted)]">{top.map((s) => s.name).join(" · ")}</p>}
    </li>
  );
}
