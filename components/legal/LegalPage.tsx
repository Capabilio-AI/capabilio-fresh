import Link from "next/link";

/** The address legal requests go to. One place to change. */
export const LEGAL_CONTACT_EMAIL = "info@capabilio.online";

export interface LegalSection {
  heading: string;
  body: string[];
}

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8">
      <Link href="/" className="font-lp-body text-[13px] font-semibold text-app-muted hover:underline">
        ← Capabilio AI
      </Link>
      <h1 className="mt-4 font-lp-display text-[34px] font-bold leading-[1.1] tracking-tight text-app-charcoal sm:text-[44px]">{title}</h1>
      <p className="mt-2 font-lp-body text-[13px] text-app-muted">Last updated {updated}</p>
      <p className="mt-6 font-lp-body text-[15px] leading-relaxed text-app-charcoal">{intro}</p>
      <nav aria-label="Contents" className="mt-6 rounded-2xl border border-app-border p-4">
        <ol className="grid list-decimal gap-1 pl-5 font-lp-body text-[13.5px] text-app-charcoal sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.heading}>
              <a href={`#s${i + 1}`} className="hover:underline">{s.heading}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.heading} id={`s${i + 1}`} className="mt-9 scroll-mt-20">
          <h2 className="font-lp-display text-[20px] font-bold text-app-charcoal">
            {i + 1}. {s.heading}
          </h2>
          {s.body.map((p) => (
            <p key={p} className="mt-3 font-lp-body text-[14.5px] leading-relaxed text-app-charcoal">{p}</p>
          ))}
        </section>
      ))}
      <p className="mt-12 border-t border-app-border pt-6 font-lp-body text-[13px] text-app-muted">
        Questions about this page: <a className="font-semibold underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. See also our{" "}
        <Link className="font-semibold underline" href={title.startsWith("Terms") ? "/privacy" : "/terms"}>{title.startsWith("Terms") ? "Privacy Policy" : "Terms of Service"}</Link>.
      </p>
    </main>
  );
}
