"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, postedLabel } from "@/lib/hiring/format";
import type { Opening } from "@/lib/hiring/types";

const ALL = "All";
const COLS = "md:grid-cols-[2.2fr_1fr_1.2fr_1fr_1fr_auto]";

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`border-2 border-[var(--crit-ink)]! px-4 py-2 text-sm font-bold transition-colors ${on ? "bg-[var(--crit-ink)] text-white" : "hover:bg-[var(--crit-ink)] hover:text-white"}`}
    >
      {label}
    </button>
  );
}

/** The roles as a plain schedule, with search and filters once there is more than one to choose between. */
export default function RoleBoard({ openings }: { openings: Opening[] }) {
  const searchId = useId();
  const [q, setQ] = useState("");
  const [team, setTeam] = useState(ALL);
  const [type, setType] = useState(ALL);
  const teams = useMemo(() => [ALL, ...Array.from(new Set(openings.map((o) => o.team)))], [openings]);
  const types = useMemo(() => [ALL, ...Array.from(new Set(openings.map((o) => EMPLOYMENT_LABEL[o.employmentType])))], [openings]);

  const needle = q.trim().toLowerCase();
  const shown = openings.filter(
    (o) =>
      (team === ALL || o.team === team) &&
      (type === ALL || EMPLOYMENT_LABEL[o.employmentType] === type) &&
      (!needle || [o.title, o.summary, o.team, o.location].some((t) => t.toLowerCase().includes(needle))),
  );
  const filtered = team !== ALL || type !== ALL || needle !== "";
  const clear = () => {
    setQ("");
    setTeam(ALL);
    setType(ALL);
  };

  if (openings.length === 0) {
    return (
      <div className="crit-vellum border-dashed! p-8 md:p-12" style={{ borderWidth: 2 }}>
        <span aria-hidden="true" className="block h-9 w-9 border-2 border-dashed border-[var(--crit-ink)]!" />
        <h3 className="crit-head mt-6 text-3xl">Nothing is open right now.</h3>
        <p className="crit-body crit-soft mt-3 max-w-lg text-lg leading-relaxed">
          That is the honest state, and we would rather say it than invent a listing. If you think you could help build this, introduce yourself below and we will write when something lines up.
        </p>
        <a href="#introduce" className="crit-btn crit-btn-ink mt-7">
          Introduce yourself <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div>
      {openings.length > 1 && (
        <div className="mb-10 grid gap-6">
          <div className="max-w-xl">
            <label htmlFor={searchId} className="crit-label mb-1 block">Search roles</label>
            <input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, team or location" className="crit-field" />
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            {teams.length > 2 && (
              <div role="group" aria-label="Filter by team" className="flex flex-wrap gap-2">
                {teams.map((t) => <Chip key={t} label={t} on={team === t} onClick={() => setTeam(t)} />)}
              </div>
            )}
            {types.length > 2 && (
              <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
                {types.map((t) => <Chip key={t} label={t} on={type === t} onClick={() => setType(t)} />)}
              </div>
            )}
          </div>
          <p aria-live="polite" className="crit-soft text-sm font-semibold">
            Showing {shown.length} of {openings.length} {openings.length === 1 ? "role" : "roles"}
            {filtered && <button type="button" onClick={clear} className="ml-3 underline hover:text-[var(--crit-pencil)]">Clear</button>}
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="crit-vellum p-8">
          <h3 className="crit-head text-2xl">No roles match that.</h3>
          <p className="crit-body crit-soft mt-2">Try a different word, or clear the filters. If nothing fits, introduce yourself below.</p>
          <button type="button" onClick={clear} className="crit-btn crit-btn-line mt-5">Clear filters</button>
        </div>
      ) : (
        <>
          <div className={`crit-label crit-soft hidden gap-6 border-t-[3px] border-[var(--crit-ink)]! px-4 pb-3 pt-3 md:grid ${COLS}`} aria-hidden="true">
            <span>Role</span><span>Team</span><span>Location</span><span>Type</span><span>Posted</span><span className="w-11" />
          </div>
          <ul className="border-t-2 border-[var(--crit-ink)]!">
            {shown.map((o) => (
              <li key={o.id} className="border-b border-[var(--crit-hair)]!">
                <Link href={`/careers/${o.slug}`} className={`crit-row group grid items-center gap-x-6 gap-y-2 px-4 py-6 ${COLS}`}>
                  <div>
                    <h3 className="crit-head text-[1.45rem] md:text-[1.7rem]">{o.title}</h3>
                    <p className="crit-body crit-soft mt-1.5 max-w-xl text-[0.95rem] leading-relaxed">{o.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 md:contents">
                    <span className="text-[0.95rem] font-semibold">{o.team}</span>
                    <span className="text-[0.95rem] font-semibold">
                      {o.location}
                      <span className="crit-soft text-[0.85rem] font-normal md:block"> &middot; {WORK_MODE_LABEL[o.workMode]}</span>
                    </span>
                    <span className="text-[0.95rem] font-semibold">{EMPLOYMENT_LABEL[o.employmentType]}</span>
                    <span className={`text-[0.9rem] ${o.status === "soon" ? "font-bold" : "crit-soft"}`}>{o.status === "soon" ? "Opening soon" : postedLabel(o.publishedAt)}</span>
                  </div>
                  <span className="mt-2 grid h-10 w-10 place-items-center border-2 border-current! transition-transform group-hover:translate-x-1 md:mt-0 md:h-11 md:w-11">
                    <ArrowRight size={18} aria-hidden="true" />
                    <span className="sr-only">View {o.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
