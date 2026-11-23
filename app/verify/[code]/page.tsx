import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadCredentialView } from "@/lib/credentials/view";
import { credentialUrl } from "@/lib/credentials/url";
import { day } from "@/lib/credentials/summary";
import { passportQrSvg } from "@/lib/passport/qr";
import { EvidenceStats, StateBanner } from "@/components/credentials/EvidenceParts";
import { PrintButton } from "@/components/credentials/PrintButton";

// A credential page is meant to be opened from a QR code or a link, not found by a search engine.
export const metadata: Metadata = { title: "Verify a Capabilio certificate", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The certificate, and the page its QR code opens. It says whether the certificate can be trusted right now, shows the headline numbers, and under the QR code
 * links to the evidence portfolio for THIS certificate. It shows nothing about the learner beyond what the signed record holds.
 */
export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const view = await loadCredentialView((await params).code, false);
  if (!view.found) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-16"><div className="rounded-2xl border border-[var(--m-rule)] bg-white p-6">
        <h1 className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">No certificate found</h1>
        <p className="mt-2 text-[15px] text-[var(--m-muted)]">We have no Capabilio certificate with the code <span className="font-lp-mono font-bold">{view.code.length <= 30 ? view.code : "you typed"}</span>. Check the code on the certificate and try again.</p>
      </div></main>
    );
  }
  const { state, payload } = view;
  const shown = payload && (state === "valid" || state === "revoked" || state === "expired");
  const url = await credentialUrl(view.code);
  const qr = await passportQrSvg(url);
  const portfolio = `${url}/portfolio`;

  return (
    <main className="mx-auto max-w-[760px] px-4 py-8 sm:py-12 print:py-0">
      <StateBanner state={state} revokedAt={view.revokedAt} />
      {shown && (
        <article className="mt-6 rounded-3xl border-2 border-[var(--m-ink)] bg-white p-6 sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--m-accent-ink)]">Capabilio AI · Proven Skill</p>
          <h1 className="mt-3 font-lp-display text-[34px] font-bold leading-[1.05] text-[var(--m-ink)] sm:text-[44px]">{payload.title}</h1>
          <p className="mt-2 text-[17px] text-[var(--m-ink)]">{payload.holder ? <>Earned by <strong>{payload.holder}</strong></> : "Earned by a verified Capabilio learner"}</p>
          <dl className="mt-5 grid gap-x-8 gap-y-2 text-[14.5px] sm:grid-cols-2">
            <div><dt className="text-[var(--m-muted)]">Level</dt><dd className="font-bold text-[var(--m-ink)]">{payload.level}</dd></div>
            <div><dt className="text-[var(--m-muted)]">Issued</dt><dd className="font-bold text-[var(--m-ink)]">{day(payload.issuedAt)}</dd></div>
            <div><dt className="text-[var(--m-muted)]">Certificate ID</dt><dd className="font-lp-mono font-bold text-[var(--m-ink)]">{payload.code}</dd></div>
            <div><dt className="text-[var(--m-muted)]">Signing key</dt><dd className="font-lp-mono font-bold text-[var(--m-ink)]">{view.keyId}</dd></div>
          </dl>

          <h2 className="mt-8 font-lp-display text-[22px] font-bold text-[var(--m-ink)]">What was proven</h2>
          <p className="mb-3 mt-1 text-[14.5px] text-[var(--m-muted)]">All {payload.totalModules} modules of this course. For each one the learner passed a test of questions and solved a coding problem checked by hidden tests, on Capabilio&apos;s server.</p>
          <EvidenceStats payload={payload} />

          <div className="mt-8 flex flex-wrap items-start gap-5 border-t border-[var(--m-rule)] pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="h-32 w-32 shrink-0" role="img" aria-label={`QR code to verify certificate ${payload.code}`} dangerouslySetInnerHTML={{ __html: qr }} />
              <Link href={`/verify/${payload.code}/portfolio`} className="inline-flex items-center gap-1.5 break-all text-center text-[13px] font-bold text-[var(--m-accent-ink)] underline">{portfolio}<ArrowRight size={13} aria-hidden className="shrink-0 print:hidden" /></Link>
            </div>
            <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-[var(--m-muted)]">
              <p className="font-bold text-[var(--m-ink)]">Evidence portfolio</p>
              <p>The link under the QR code opens the evidence for this certificate only: each module, the test score, the problem and the tests met, and the learner&apos;s own code when they have chosen to show it. It shows nothing else about the learner.</p>
              <p className="mt-2">Anyone can check the signature with the public key at <span className="font-lp-mono">/api/credentials/public-key</span>.</p>
            </div>
          </div>
        </article>
      )}
      <div className="mt-5 print:hidden"><PrintButton /></div>
    </main>
  );
}
