import { Briefcase, Clock } from "lucide-react";
import type { MentorCardPro } from "@/lib/mentorship/server";
import { RequestSession } from "@/components/mentorship/RequestSession";
import { ProAvatar } from "./ProAvatar";

/** Mentors who are open to working professionals. Booking one of their times sends them an alert to approve. */
export function MentorsTab({ mentors, query }: { mentors: MentorCardPro[]; query: string }) {
  return (
    <div className="flex flex-col gap-4">
      <form action="/professional/pulse" method="get" role="search" className="flex gap-2">
        <input type="hidden" name="tab" value="mentors" />
        <label htmlFor="mentor-q" className="sr-only">Search mentors</label>
        <input id="mentor-q" name="q" defaultValue={query} placeholder="Search mentors by name, company or skill" className="min-w-0 flex-1 rounded-full border border-[var(--m-soft)] bg-white px-5 py-2.5 text-[14px] focus:border-[var(--m-ink)] focus:outline-none" />
        <button type="submit" className="rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white">Search</button>
      </form>
      {mentors.length === 0 ? (
        <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">{query ? "No mentors match that search." : "No mentors are open to working professionals yet. Mentors appear here once Capabilio approves them and they choose to mentor professionals."}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {mentors.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 rounded-3xl border border-[var(--m-rule)] bg-white p-5">
              <div className="flex items-start gap-3">
                <ProAvatar name={m.name} url={m.avatarUrl} size={48} />
                <div className="min-w-0"><p className="text-[15px] font-bold text-[var(--m-ink)]">{m.name}</p><p className="text-[13px] text-[var(--m-muted)]">{m.headline}</p>{(m.company || m.roleTitle) && <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[var(--m-muted)]"><Briefcase size={12} aria-hidden />{[m.roleTitle, m.company].filter(Boolean).join(" at ")}{m.yearsExperience != null ? ` · ${m.yearsExperience} years` : ""}</p>}</div>
              </div>
              <p className="line-clamp-3 text-[14px] leading-relaxed text-[var(--m-ink)]">{m.bio}</p>
              <ul aria-label="Topics" className="flex flex-wrap gap-1.5">{m.expertise.map((t) => <li key={t} className="rounded-full border border-[var(--m-rule)] px-2.5 py-0.5 text-[12px] text-[var(--m-muted)]">{t}</li>)}</ul>
              {m.availability && <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--m-muted)]"><Clock size={12} aria-hidden />{m.availability}</p>}
              <div className="mt-auto border-t border-[var(--m-rule)] pt-3"><RequestSession mentorId={m.id} mentorName={m.name} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
