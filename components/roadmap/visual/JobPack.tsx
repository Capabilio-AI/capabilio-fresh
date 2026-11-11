"use client";

import { useEffect, useState } from "react";
import { formatJobPay, formatLpa } from "@/lib/market/format";
import type { JobPack as Pack } from "@/lib/market/job-pack";
import type { JobMatch } from "@/lib/market/match";
import type { MarketJob } from "@/lib/market/snapshot";

interface Data {
  career: { id: string; name: string };
  market: {
    sampled: number; fetchedAt: string;
    salary: { p25: number; median: number; p75: number; sample: number } | null;
    titles: { name: string; postings: number }[]; companies: { name: string; postings: number }[]; locations: { name: string; postings: number }[];
    topSkills: { skillId: string; name: string; share: number; yourLevel: number | null }[];
  } | null;
  jobs: (MarketJob & { match: JobMatch })[];
  pack: Pack | null;
}

const H = "text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]";
const CARD = "rounded-xl border border-[var(--m-rule)]! bg-white p-5";
const CHIP = "rounded-full border border-[var(--m-rule)] px-3 py-1 text-[12.5px]";

function useJobPack(career: "primary" | "plan-b") {
  const [state, setState] = useState<{ data?: Data; error?: string }>({});
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/roadmap/job-pack?career=${career}`);
        const body = (await res.json().catch(() => ({}))) as Data & { error?: string };
        if (!cancelled) setState(res.ok ? { data: body } : { error: body.error ?? "Couldn't load your job pack." });
      } catch {
        if (!cancelled) setState({ error: "Couldn't reach the server. Check your connection and try again." });
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [career]);
  return state;
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={CARD} aria-label={title}>
      <h3 className={H}>{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

function Chips({ title, items }: { title: string; items: { name: string; postings: number }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className={H}>{title}</h4>
      <ul className="mt-1.5 flex flex-wrap gap-2">{items.map((i) => <li key={i.name} className={CHIP}>{i.name} <span className="text-app-muted">· {i.postings}</span></li>)}</ul>
    </div>
  );
}

export function JobPack({ career }: { career: "primary" | "plan-b" }) {
  const { data, error } = useJobPack(career);
  if (error) return <p role="alert" className="text-[14px] text-app-rose">{error}</p>;
  if (!data) return <p className="text-[14px] text-app-muted">Gathering the market for your role… this can take a few seconds the first time.</p>;
  const { market, pack, jobs } = data;
  return (
    <div className="space-y-5 font-lp-body text-[var(--m-ink)]">
      {!market ? (
        <p className={`${CARD} text-[14px]`}>Live job-market data isn&apos;t switched on yet, so pay, who is hiring and open jobs for <b>{data.career.name}</b> aren&apos;t shown. Interview and resume prep below still apply.</p>
      ) : (
        <>
          <section className={CARD} aria-label="Pay and hiring">
            <h3 className={H}>{data.career.name}: pay and hiring</h3>
            <p className="mt-1 text-[12.5px] text-app-muted">From {market.sampled} current job postings in India, checked {new Date(market.fetchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.</p>
            {market.salary ? (
              <p className="mt-3 text-[15px]">Typical pay: <b>{formatLpa(market.salary.median)}</b> <span className="text-app-muted">(middle half {formatLpa(market.salary.p25)} to {formatLpa(market.salary.p75)}, from the {market.salary.sample} postings that state a salary)</span></p>
            ) : (
              <p className="mt-3 text-[14px] text-app-muted">Few postings state a salary, so no pay figure is shown rather than a guess.</p>
            )}
            <div className="mt-4 space-y-4">
              <Chips title="Job titles" items={market.titles} />
              <Chips title="Hiring most" items={market.companies} />
              <Chips title="Where" items={market.locations} />
            </div>
          </section>

          {market.topSkills.length > 0 && (
            <section className={CARD} aria-label="Skills employers ask for">
              <h3 className={H}>Skills employers ask for, and where you stand</h3>
              <p className="mt-1 text-[12.5px] text-app-muted">Share of postings that mention the skill (from the short posting text, so real demand is higher).</p>
              <ul className="mt-3 space-y-2.5">
                {market.topSkills.map((s) => (
                  <li key={s.skillId} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13.5px] sm:grid-cols-[12rem_1fr_9rem]">
                    <span className="truncate font-semibold">{s.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--m-ground)]" aria-hidden><span className="block h-full rounded-full bg-[var(--m-ink)]" style={{ width: `${Math.min(100, Math.round(s.share * 100))}%` }} /></span>
                    <span className="text-right text-[12.5px] text-app-muted">{Math.round(s.share * 100)}% · {s.yourLevel === null ? "not shown yet" : `you: ${Math.round(s.yourLevel)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={CARD} aria-label="Open jobs">
            <h3 className={H}>Open jobs, and how close you are</h3>
            <p className="mt-1 text-[12.5px] text-app-muted">Match counts the skills named in each posting that you already show at 50 or more. Postings link to the job site.</p>
            {jobs.length === 0 ? <p className="mt-3 text-[14px] text-app-muted">No openings were returned for this role right now.</p> : (
              <ul className="mt-3 divide-y divide-[var(--m-rule)]">
                {jobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <a href={j.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-app-blue hover:underline">{j.title}<span className="sr-only"> (opens in a new tab)</span></a>
                      <p className="text-[13px] text-app-muted">{[j.company, j.location, formatJobPay(j.salaryMin, j.salaryMax)].filter(Boolean).join(" · ")}</p>
                      {j.match.missing.length > 0 && <p className="mt-0.5 text-[12.5px]">To work on: {j.match.missing.slice(0, 5).join(", ")}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--m-ground)] px-3 py-1 text-[12.5px] font-bold">{j.match.percent === null ? "match unknown" : `${j.match.percent}% match`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {pack ? (
        <>
          <section className={CARD} aria-label="Interview preparation">
            <h3 className={H}>Interview preparation</h3>
            <ul className="mt-3 space-y-3">
              {pack.interviewTopics.map((t) => (
                <li key={t.topic}>
                  <p className="font-semibold">{t.topic}</p>
                  <p className="text-[13.5px] text-app-muted">{t.why}{t.skills.length > 0 ? ` (${t.skills.join(", ")})` : ""}</p>
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-[13.5px] font-bold">Practice questions ({pack.practiceQuestions.length})</summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px]">{pack.practiceQuestions.map((q) => <li key={q}>{q}</li>)}</ol>
            </details>
            <p className="mt-3 text-[12px] text-app-muted">Written by AI for this role. Treat it as a study guide, not a promise of what you will be asked.</p>
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            <List title="Resume checklist" items={pack.resumeChecklist} />
            <List title="Portfolio checklist" items={pack.portfolioChecklist} />
          </div>
        </>
      ) : (
        <p className={`${CARD} text-[14px] text-app-muted`}>Interview and resume prep for this role isn&apos;t ready yet. Check back shortly.</p>
      )}
    </div>
  );
}
