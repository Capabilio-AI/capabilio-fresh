import { CheckCircle2, ShieldAlert, ShieldX } from "lucide-react";
import type { CredentialPayload, CredentialState } from "@/lib/credentials/credential";
import { day, summarise } from "@/lib/credentials/summary";

const BANNER: Record<CredentialState, { tone: string; title: string; body: string }> = {
  valid: { tone: "bg-[#e8f5ee] text-[#0f5132]", title: "Valid", body: "The signature matches. This credential was issued by Capabilio AI and has not been revoked." },
  revoked: { tone: "bg-red-50 text-red-800", title: "Revoked", body: "Capabilio AI has withdrawn this credential. It should not be relied on." },
  expired: { tone: "bg-amber-50 text-amber-900", title: "Expired", body: "This credential was valid, but its validity period has ended." },
  tampered: { tone: "bg-red-50 text-red-800", title: "Does not verify", body: "This record does not match its signature. Do not trust it." },
  unverifiable: { tone: "bg-amber-50 text-amber-900", title: "Cannot be checked right now", body: "Verification is not available at the moment. This is not a result about the credential: please try again later." },
};

/** The result of checking the credential, in words and colour. */
export function StateBanner({ state, revokedAt }: { state: CredentialState; revokedAt: string | null }) {
  const b = BANNER[state];
  const Icon = state === "valid" ? CheckCircle2 : state === "tampered" || state === "revoked" ? ShieldX : ShieldAlert;
  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl p-4 ${b.tone}`}>
      <Icon size={22} aria-hidden className="mt-0.5 shrink-0" />
      <div><p className="text-[18px] font-bold">{b.title}</p><p className="text-[14.5px]">{b.body}</p>{revokedAt && state === "revoked" && <p className="mt-1 text-[13.5px]">Revoked on {day(revokedAt)}.</p>}</div>
    </div>
  );
}

/** The headline numbers of this certificate's evidence. */
export function EvidenceStats({ payload }: { payload: CredentialPayload }) {
  const t = summarise(payload.modules);
  const cells: [string, string][] = [
    ["Modules proven", `${t.modules} of ${payload.totalModules}`],
    ["Test average", t.testPct === null ? "Not recorded" : `${t.testPct}%`],
    ["Problems solved", t.problems === 0 ? "Not recorded" : `${t.problems}`],
    ["Tests met", t.testsTotal === 0 ? "Not recorded" : `${t.testsPassed} of ${t.testsTotal}`],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([k, v]) => <div key={k} className="rounded-xl bg-[var(--m-ground)] p-3"><dt className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{k}</dt><dd className="mt-0.5 text-[20px] font-bold text-[var(--m-ink)]">{v}</dd></div>)}
      </dl>
      <p className="mt-2 text-[13.5px] text-[var(--m-muted)]">{t.languages.length > 0 && <>Language: {t.languages.join(", ")}. </>}Proven between {day(t.first)} and {day(t.last)}, in {t.tries} tries in total.</p>
    </>
  );
}

/** The evidence of each module of this certificate. The learner's solution is shown only when it was released and still matches the signed fingerprint. */
export function EvidenceList({ payload, solutions, showCode }: { payload: CredentialPayload; solutions: Record<string, string>; showCode: boolean }) {
  return (
    <ol className="flex flex-col gap-3">
      {payload.modules.map((m, i) => (
        <li key={m.k} className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
          <p className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]"><span className="ss-num mr-1.5 text-[var(--m-muted)]">{i + 1}.</span>{m.t}</span><span className="text-[13px] text-[var(--m-muted)]">Proven {day(m.p)}</span></p>
          <ul className="mt-2 flex flex-wrap gap-2 text-[13.5px]">
            <li className="rounded-full bg-[var(--m-ground)] px-3 py-1">{m.sc !== null && m.st !== null ? `Test: ${m.sc} of ${m.st} (${Math.round((m.sc / m.st) * 100)}%)` : "Test score: not recorded"}</li>
            <li className="rounded-full bg-[var(--m-ground)] px-3 py-1">{m.pl ? `Problem: ${m.pl}${m.tp !== null && m.tn !== null ? `, ${m.tp} of ${m.tn} tests met` : ""}` : "Problem details: not recorded"}</li>
            <li className="rounded-full bg-[var(--m-ground)] px-3 py-1">{m.aa} test {m.aa === 1 ? "try" : "tries"}, {m.pa} problem {m.pa === 1 ? "try" : "tries"}</li>
          </ul>
          {solutions[m.k] ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-[14px] font-bold text-[var(--m-accent-ink)] print:hidden">View the learner&apos;s solution</summary>
              <pre className="ss-scroll mt-2 overflow-x-auto rounded-lg bg-[var(--m-ink)] p-4 font-lp-mono text-[12.5px] leading-relaxed text-white print:whitespace-pre-wrap"><code>{solutions[m.k]}</code></pre>
              <p className="mt-1 text-[12px] text-[var(--m-muted)]">This is the code that passed. Its SHA-256 matches the signed record: <span className="font-lp-mono">{(m.ch ?? "").slice(0, 16)}…</span></p>
            </details>
          ) : <p className="mt-2 text-[12.5px] text-[var(--m-muted)]">{showCode ? "The solution is not shown: it is not available, or it no longer matches the signed fingerprint." : "The learner has not chosen to show their solution code."}</p>}
        </li>
      ))}
    </ol>
  );
}
