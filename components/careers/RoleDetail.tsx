import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, paragraphs, postedLabel } from "@/lib/hiring/format";
import type { Opening } from "@/lib/hiring/types";
import { CAREERS_EMAIL, HIRING_STEPS, TEAM_BLURBS, WORK_CULTURE, mailtoFor } from "@/lib/hiring/content";
import ApplyForm from "./ApplyForm";
import PencilMark from "./PencilMark";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="crit-rule3 pt-6">
      <h2 className="crit-head text-[1.7rem]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3.5">
      {items.map((t) => (
        <li key={t} className="crit-body flex gap-3.5 text-[1.05rem] leading-relaxed">
          <span aria-hidden="true" className="mt-[0.78em] h-[3px] w-3.5 shrink-0 bg-[var(--crit-pencil)]" />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** One role: what it is, what the first proof looks like, and the form. A closed role keeps its page and says so. */
export default function RoleDetail({ opening: o, accepting, others = [] }: { opening: Opening; accepting: boolean; others?: Opening[] }) {
  const facts = [o.team, o.location, WORK_MODE_LABEL[o.workMode], EMPLOYMENT_LABEL[o.employmentType], ...(o.compensation ? [o.compensation] : [])];
  return (
    <>
      <header className="px-5 pb-14 pt-10 md:px-10 md:pb-20 md:pt-14">
        <div className="mx-auto max-w-[84rem]">
          <Link href="/careers#roles" className="crit-label inline-flex items-center gap-2 hover:text-[var(--crit-pencil)]">
            <ArrowLeft size={15} aria-hidden="true" /> All roles
          </Link>
          <h1 className="crit-title mt-7 max-w-5xl text-[clamp(2.4rem,5.6vw,5rem)]">{o.title}</h1>
          <p className="crit-body crit-soft mt-6 max-w-2xl text-xl leading-relaxed">{o.summary}</p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {facts.map((f) => (
              <span key={f} className="crit-strip">{f}</span>
            ))}
            {accepting && postedLabel(o.publishedAt) && <span className="crit-soft px-2 text-sm font-semibold">{postedLabel(o.publishedAt)}</span>}
          </div>
          {accepting && (
            <a href="#apply" className="crit-btn crit-btn-red mt-9 lg:hidden">
              Apply with proof <ArrowDown size={18} aria-hidden="true" />
            </a>
          )}
        </div>
      </header>

      <div className="bg-[var(--crit-board-deep)] px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[84rem] gap-16 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <article className="grid gap-12">
            <Section title="About the role">
              <div className="grid gap-4">
                {paragraphs(o.about).map((p) => (
                  <p key={p} className="crit-body text-[1.05rem] leading-relaxed">{p}</p>
                ))}
              </div>
            </Section>
            {o.dayToDay && (
              <Section title="What the work looks like">
                <div className="grid gap-4">
                  {paragraphs(o.dayToDay).map((p) => (
                    <p key={p} className="crit-body text-[1.05rem] leading-relaxed">{p}</p>
                  ))}
                </div>
              </Section>
            )}
            {o.responsibilities.length > 0 && (
              <Section title="What you will do">
                <Bullets items={o.responsibilities} />
              </Section>
            )}
            {o.requirements.length > 0 && (
              <Section title="What you bring">
                <Bullets items={o.requirements} />
              </Section>
            )}
            {o.niceToHave.length > 0 && (
              <Section title="Nice to have">
                <Bullets items={o.niceToHave} />
              </Section>
            )}
            {o.proofBrief && (
              <section className="crit-vellum p-6 md:p-8">
                <h2 className="crit-head relative inline-block text-[1.7rem]">
                  Your first proof
                  <PencilMark kind="underline" className="-bottom-2.5 left-0 h-3 w-full" delay="0.2s" />
                </h2>
                <p className="crit-body crit-soft mt-5 text-[0.95rem] leading-relaxed">After we read your application, this is the kind of problem you would work on. You see it now so nothing is a surprise.</p>
                <div className="mt-5 grid gap-3">
                  {paragraphs(o.proofBrief).map((p) => (
                    <p key={p} className="crit-body text-[1.05rem] leading-relaxed">{p}</p>
                  ))}
                </div>
              </section>
            )}
            {o.firstMonths.length > 0 && (
              <Section title="Your first months">
                <Bullets items={o.firstMonths} />
              </Section>
            )}
            <Section title="How we work">
              <p className="crit-body text-[1.05rem] leading-relaxed">{WORK_CULTURE.intro}</p>
              <ul className="crit-schedule mt-6">
                {WORK_CULTURE.asks.map((a) => (
                  <li key={a.title} className="grid gap-1 py-4 sm:grid-cols-[0.8fr_1.2fr] sm:gap-8">
                    <span className="crit-head text-[1.1rem]">{a.title}</span>
                    <span className="crit-body crit-soft text-[1rem] leading-relaxed">{a.body}</span>
                  </li>
                ))}
              </ul>
              <h3 className="crit-label mb-3 mt-8">What you can expect from us</h3>
              <Bullets items={[...WORK_CULTURE.gives, WORK_CULTURE.hybrid]} />
            </Section>
            <Section title="How we interview">
              <p className="crit-body crit-soft mb-2 text-[1rem] leading-relaxed">Four steps, in this order. You always know which one you are in.</p>
              <ol className="crit-schedule">
                {(o.interview.length > 0 ? o.interview : HIRING_STEPS.map((s) => ({ title: s.title, body: s.body }))).map((s, i) => (
                  <li key={s.title} className="grid gap-3 py-5 sm:grid-cols-[auto_0.8fr_1.4fr] sm:gap-8">
                    <span className="relative grid h-10 w-10 place-items-center text-xl font-extrabold text-[var(--crit-pencil)]" style={{ fontStretch: "118%" }}>
                      {i + 1}
                      <PencilMark kind="circle" className="-inset-1 h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)]" delay="0s" />
                    </span>
                    <span className="crit-head text-[1.2rem]">{s.title}</span>
                    <span className="crit-body crit-soft text-[1rem] leading-relaxed">{s.body}</span>
                  </li>
                ))}
              </ol>
            </Section>
          </article>

          <aside id="apply" className="scroll-mt-20 lg:sticky lg:top-24">
            <div className="crit-sheet single crit-tilt p-6 pt-8 md:p-8 md:pt-10" style={{ "--r": "0.6deg" } as React.CSSProperties}>
              {accepting ? (
                <>
                  <h2 className="crit-head text-[1.7rem]">Apply with proof</h2>
                  <p className="crit-body crit-soft mb-7 mt-2 text-[0.95rem] leading-relaxed">Show us the work. A resume is optional.</p>
                  <ApplyForm openingId={o.id} roleTitle={o.title} />
                  <p className="crit-body crit-soft mt-7 border-t border-[var(--crit-hair)]! pt-5 text-[0.9rem] leading-relaxed">
                    Prefer email? Send your profile and portfolio to{" "}
                    <a href={mailtoFor(`Application: ${o.title}`)} className="font-bold text-[var(--crit-ink)] underline decoration-[var(--crit-pencil)] decoration-2">{CAREERS_EMAIL}</a>.
                  </p>
                </>
              ) : (
                <div role="status">
                  <h2 className="crit-head text-[1.7rem]">{o.status === "soon" ? "This role opens soon." : "This role has closed."}</h2>
                  <p className="crit-body crit-soft mt-3 text-lg leading-relaxed">
                    {o.status === "soon" ? "It is not taking applications yet. Introduce yourself now and we will write when it opens." : "It is no longer taking applications. You can still introduce yourself for future roles."}
                  </p>
                  <Link href="/careers#introduce" className="crit-btn crit-btn-ink mt-6">
                    Introduce yourself
                  </Link>
                  <p className="crit-body crit-soft mt-5 text-[0.9rem]">
                    Or email <a href={mailtoFor(`Interested in ${o.title}`)} className="font-bold text-[var(--crit-ink)] underline decoration-[var(--crit-pencil)] decoration-2">{CAREERS_EMAIL}</a>.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {others.length > 0 && (
        <section className="px-5 py-20 md:px-10 md:py-24">
          <div className="mx-auto max-w-[84rem]">
            <h2 className="crit-head text-[clamp(1.6rem,3vw,2.2rem)]">{others.every((r) => r.team === o.team) ? `More in ${o.team}` : "Other roles"}</h2>
            {TEAM_BLURBS[o.team] && others.every((r) => r.team === o.team) && <p className="crit-body crit-soft mt-2 max-w-xl">{TEAM_BLURBS[o.team]}</p>}
            <ul className="crit-schedule mt-8">
              {others.map((r) => (
                <li key={r.id}>
                  <Link href={`/careers/${r.slug}`} className="crit-row flex items-center justify-between gap-4 px-2 py-5">
                    <span className="crit-head text-[1.25rem]">{r.title}</span>
                    <span className="crit-soft text-[0.9rem]">{r.status === "soon" ? "Opening soon" : EMPLOYMENT_LABEL[r.employmentType]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
