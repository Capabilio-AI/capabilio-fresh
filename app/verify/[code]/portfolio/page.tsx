import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadCredentialView } from "@/lib/credentials/view";
import { day } from "@/lib/credentials/summary";
import { EvidenceList, EvidenceStats, StateBanner } from "@/components/credentials/EvidenceParts";
import { PrintButton } from "@/components/credentials/PrintButton";

export const metadata: Metadata = { title: "Evidence portfolio | Capabilio certificate", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The evidence portfolio of ONE certificate: what a recruiter sees after scanning. Only this certificate's own evidence is here (its modules, scores, tests met
 * and, if the learner chose, their solutions). There is no passport, no badges, no other course and no personal detail: the page reads nothing else.
 */
export default async function PortfolioPage({ params }: { params: Promise<{ code: string }> }) {
  const view = await loadCredentialView((await params).code, true);
  if (!view.found) {
    return <main className="mx-auto max-w-[640px] px-4 py-16"><div className="rounded-2xl border border-[var(--m-rule)] bg-white p-6"><h1 className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">No certificate found</h1><p className="mt-2 text-[15px] text-[var(--m-muted)]">We have no Capabilio certificate with that code.</p></div></main>;
  }
  const { state, payload } = view;
  const shown = payload && (state === "valid" || state === "revoked" || state === "expired");
  return (
    <main className="mx-auto max-w-[760px] px-4 py-8 sm:py-12 print:py-0">
      <p className="mb-3 print:hidden"><Link href={`/verify/${view.code}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden />Back to the certificate</Link></p>
      <StateBanner state={state} revokedAt={view.revokedAt} />
      {shown && (
        <section aria-labelledby="pf" className="mt-6 rounded-3xl border-2 border-[var(--m-ink)] bg-white p-6 sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--m-accent-ink)]">Evidence portfolio · Capabilio AI</p>
          <h1 id="pf" className="mt-3 font-lp-display text-[32px] font-bold leading-[1.05] text-[var(--m-ink)] sm:text-[40px]">{payload.title}</h1>
          <p className="mt-2 text-[16px] text-[var(--m-ink)]">{payload.holder ? <>Earned by <strong>{payload.holder}</strong>. </> : "Earned by a verified Capabilio learner. "}Certificate <span className="font-lp-mono font-bold">{payload.code}</span>, issued {day(payload.issuedAt)}.</p>
          <p className="mt-2 text-[14.5px] text-[var(--m-muted)]">This page holds only the evidence behind this certificate. Every number is part of the signed record.</p>
          <div className="mt-5"><EvidenceStats payload={payload} /></div>
          <h2 className="mb-3 mt-8 font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Module by module</h2>
          <EvidenceList payload={payload} solutions={view.solutions} showCode={view.showCode} />
        </section>
      )}
      <div className="mt-5 print:hidden"><PrintButton /></div>
    </main>
  );
}
