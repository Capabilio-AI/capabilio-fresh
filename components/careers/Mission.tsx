import { MISSION } from "@/lib/hiring/content";

/** What the company is, said plainly, before any role: where a portal visitor asks "why here?". */
export default function Mission() {
  return (
    <section id="mission" className="border-t-[3px] border-[var(--crit-ink)]! px-5 py-24 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-[84rem] gap-14 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <h2 className="crit-head max-w-3xl text-[clamp(2rem,4.6vw,3.6rem)]">{MISSION.title}</h2>
          <p className="crit-body crit-soft mt-7 max-w-2xl text-xl leading-relaxed">{MISSION.body}</p>
        </div>
        <div>
          <h3 className="crit-label mb-4">Who it serves</h3>
          <ul className="crit-schedule">
            {MISSION.serves.map((s) => (
              <li key={s.who} className="py-5">
                <div className="crit-head text-[1.25rem]">{s.who}</div>
                <p className="crit-body crit-soft mt-1.5 text-[0.95rem] leading-relaxed">{s.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
