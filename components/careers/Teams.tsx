import Link from "next/link";
import { TEAM_BLURBS } from "@/lib/hiring/content";
import { EMPLOYMENT_LABEL } from "@/lib/hiring/format";
import type { Opening } from "@/lib/hiring/types";

/** Teams that have a role listed, each on a tracing-paper sheet with its roles underneath. */
export default function Teams({ openings }: { openings: Opening[] }) {
  const teams = Array.from(new Set(openings.map((o) => o.team)));
  if (teams.length === 0) return null;
  return (
    <section id="teams" className="bg-[var(--crit-board-deep)] px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[84rem]">
        <h2 className="crit-head max-w-3xl text-[clamp(2rem,4.6vw,3.6rem)]">Find your team.</h2>
        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {teams.map((team) => {
            const roles = openings.filter((o) => o.team === team);
            return (
              <div key={team} className="crit-vellum">
                <div className="crit-strip w-full justify-between rounded-none">
                  <span>{team}</span>
                  <span className="opacity-70">{roles.length} {roles.length === 1 ? "role" : "roles"}</span>
                </div>
                <div className="p-6 md:p-7">
                  {TEAM_BLURBS[team] && <p className="crit-body crit-soft text-[1.05rem] leading-relaxed">{TEAM_BLURBS[team]}</p>}
                  <ul className="mt-5 border-t border-[var(--crit-hair)]!">
                    {roles.map((o) => (
                      <li key={o.id} className="border-b border-[var(--crit-hair)]!">
                        <Link href={`/careers/${o.slug}`} className="crit-row flex items-center justify-between gap-4 px-2 py-3.5">
                          <span className="font-bold">{o.title}</span>
                          <span className="crit-soft text-[0.85rem]">{o.status === "soon" ? "Opening soon" : EMPLOYMENT_LABEL[o.employmentType]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
