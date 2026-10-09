import { ArrowUpRight, BookOpen, CheckCircle2, Clock, Wallet, ShieldCheck } from "lucide-react";
import type { CertCard, CertSection } from "@/lib/skillstudio/certifications";

const DIFFICULTY: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} aria-hidden className="mt-0.5 shrink-0 text-[var(--m-muted)]" />
      <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{label}</p><p className="text-[13.5px] leading-snug text-[var(--m-ink)]">{value}</p></div>
    </div>
  );
}

function Card({ c }: { c: CertCard }) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">
          {c.provider}{c.difficulty && <span className="rounded-full bg-[var(--m-ground)] px-2 py-0.5 text-[10.5px] text-[var(--m-ink)]">{DIFFICULTY[c.difficulty] ?? c.difficulty.toLowerCase()}</span>}
        </p>
        <h3 className="mt-1 font-lp-display text-[19px] font-bold leading-snug text-[var(--m-ink)]">{c.title}</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {c.cost && <Fact icon={Wallet} label="Cost" value={c.cost} />}
        {c.exam && <Fact icon={Clock} label="Exam" value={c.exam} />}
        {c.prerequisites && <div className="sm:col-span-2"><Fact icon={ShieldCheck} label="Before you start" value={c.prerequisites} /></div>}
      </div>

      {(c.validates.length > 0 || c.skills.length > 0) && (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">What you gain</p>
          {c.validates.length > 0 && <ul className="mt-2 flex flex-col gap-1.5">{c.validates.map((v) => <li key={v} className="flex items-start gap-2 text-[13.5px] text-[var(--m-ink)]"><CheckCircle2 size={15} aria-hidden className="mt-0.5 shrink-0 text-[#0d7a45]" />{v}</li>)}</ul>}
          {c.skills.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-app-muted">
              Builds your roadmap skills:
              {c.skills.map((s) => <span key={s.name} className="rounded-full bg-[var(--m-ground)] px-2.5 py-0.5 font-bold text-[var(--m-ink)]">{s.name}{s.level !== null ? ` · you ${s.level}%` : ""}</span>)}
            </p>
          )}
        </div>
      )}

      {c.learn.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]"><BookOpen size={13} aria-hidden />Where to learn (free)</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {c.learn.map((l) => (
              <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 rounded-lg bg-[var(--m-ground)] px-3 py-2 text-[13px] hover:bg-[var(--m-rule)]">
                <span className="min-w-0"><span className="block truncate font-bold text-[var(--m-ink)]">{l.title}</span><span className="text-[11.5px] text-app-muted">{l.provider}{l.hours ? ` · about ${l.hours} h` : ""}</span></span>
                <ArrowUpRight size={14} aria-hidden className="shrink-0 text-[var(--m-muted)]" />
              </a></li>
            ))}
          </ul>
        </div>
      )}

      {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-4 py-2.5 text-[13.5px] font-bold text-white transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">Official page and registration <ArrowUpRight size={14} aria-hidden /></a>}
    </li>
  );
}

export function CertCards({ sections }: { sections: CertSection[] }) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((s) => (
        <section key={s.which} aria-labelledby={`cert-${s.which}`}>
          <h2 id={`cert-${s.which}`} className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{s.which === "primary" ? `Certifications for ${s.careerName}` : `Certifications for ${s.careerName} (Plan B)`}</h2>
          <p className="mb-4 mt-1 max-w-[75ch] text-[13.5px] text-app-muted">Each one is on your career roadmap. Learn it, earn it, and add the credential to your Vault. Prices and exam details are typical figures: they change by country and over time, so confirm on the official page before you pay.</p>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">{s.certs.map((c) => <Card key={c.id} c={c} />)}</ul>
        </section>
      ))}
    </div>
  );
}
