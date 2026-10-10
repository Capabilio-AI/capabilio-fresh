import type { AttemptEvidence } from "@/lib/arena/attempt-evidence";

const BOX = "rounded-xl border border-[var(--m-rule)] p-4";
const H3 = "font-lp-body text-[13px] font-semibold text-[var(--m-ink)]";
const PRE = "mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-lg bg-app-background p-3 font-lp-mono text-[12px] text-[var(--m-ink)]";

/** The full record of one Domain ticket: what was given, what the student wrote, what was expected against what they produced, and what it earned. */
export function TicketEvidence({ data }: { data: AttemptEvidence }) {
  const t = data.ticket!;
  const written = data.submissionText?.trim();
  return (
    <div className="mt-4 flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[["Score", `${t.score}%`], ["Checks passed", `${t.checksPassed} of ${t.checksTotal}`], ["ELO gained", `+${t.eloDelta}`]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-app-background px-2 py-3">
            <dd className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{v}</dd>
            <dt className="mt-0.5 font-lp-body text-[12px] text-app-muted">{k}</dt>
          </div>
        ))}
      </dl>

      <section className={BOX}>
        <h3 className={H3}>1. What was given</h3>
        <p className="mt-2 whitespace-pre-wrap font-lp-body text-[13.5px] leading-relaxed text-[var(--m-ink)]">{data.scenario}</p>
        {data.objectiveLines.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {data.objectiveLines.map((l, i) => <li key={i} className="font-lp-body text-[13px] text-[var(--m-ink)]">{l}</li>)}
          </ul>
        )}
        {t.given.files.map((f) => (
          <div key={f.name} className="mt-3"><p className="font-lp-mono text-[11.5px] text-app-muted">File: {f.name}</p><pre className={PRE}>{f.content}</pre></div>
        ))}
        {t.given.cells.map((c, i) => (
          <div key={i} className="mt-3"><p className="font-lp-mono text-[11.5px] text-app-muted">Starter code</p><pre className={PRE}>{c}</pre></div>
        ))}
        {t.given.seedSql && <div className="mt-3"><p className="font-lp-mono text-[11.5px] text-app-muted">Database setup</p><pre className={PRE}>{t.given.seedSql}</pre></div>}
      </section>

      <section className={BOX}>
        <h3 className={H3}>2. What the student wrote</h3>
        {written ? <pre className={PRE}>{written}</pre> : <p className="mt-2 font-lp-body text-[13px] text-app-muted">Nothing was recorded.</p>}
        {t.terminalOutput && <pre className={PRE}>{t.terminalOutput}</pre>}
        {t.reflection && <p className="mt-3 whitespace-pre-wrap font-lp-body text-[13px] text-[var(--m-ink)]"><span className="font-semibold">Reflection: </span>{t.reflection}</p>}
      </section>

      <section className={BOX}>
        <h3 className={H3}>3. Expected output and the student&apos;s output</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse font-lp-body text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--m-rule)] text-left text-app-muted"><th className="py-1.5 pr-3 font-semibold">Check</th><th className="py-1.5 pr-3 font-semibold">Expected</th><th className="py-1.5 pr-3 font-semibold">Student&apos;s output</th><th className="py-1.5 font-semibold">Result</th></tr>
            </thead>
            <tbody>
              {t.comparison.map((c, i) => (
                <tr key={i} className="border-b border-[var(--m-rule)] align-top last:border-0">
                  <td className="py-2 pr-3 text-[var(--m-ink)]">{c.label}</td>
                  <td className="py-2 pr-3 font-lp-mono text-[var(--m-ink)]">{c.expected}</td>
                  <td className="whitespace-pre-wrap py-2 pr-3 font-lp-mono text-[var(--m-ink)]">{c.got}</td>
                  <td className={`py-2 font-semibold ${c.passed ? "text-app-success" : "text-app-rose"}`}>{c.passed ? "Passed" : "Not passed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-lp-body text-[12px] text-app-muted">Graded by Capabilio&apos;s automated checks, not by AI. {t.hintsUsed > 0 ? `${t.hintsUsed} hint${t.hintsUsed === 1 ? "" : "s"} used.` : "No hints used."}</p>
      </section>
    </div>
  );
}
