import { BELIEFS } from "@/lib/hiring/content";

/** The principles as a drawing schedule: a heavy rule, then one ruled row each. */
export default function Beliefs() {
  return (
    <section id="how-we-build" className="bg-[var(--crit-board-deep)] px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[84rem]">
        <h2 className="crit-head max-w-3xl text-[clamp(2rem,4.6vw,3.6rem)]">How we build is how we work.</h2>
        <ul className="crit-schedule mt-14">
          {BELIEFS.map((b) => (
            <li key={b.title} className="grid gap-3 py-8 md:grid-cols-[1fr_1.15fr] md:gap-16 md:py-10">
              <h3 className="crit-head text-[clamp(1.5rem,2.6vw,2.1rem)]">{b.title}</h3>
              <p className="crit-body crit-soft text-lg leading-relaxed">{b.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
