import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, ExternalLink } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { categoryFromSlug, deriveCapabilityProfile, type ArenaProgrammingEvidence } from "@/lib/code-dna/capability-derivation";
import { explainCapability, matchingRepos } from "@/lib/code-dna/capability-explain";
import type { GithubScanResult } from "@/lib/code-dna/github-scan";
import { SECTION_LABEL } from "@/lib/assessment/sections";

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  return { title: category ? `${category} — Code DNA — Capabilio AI` : "Code DNA — Capabilio AI" };
}

const CONFIDENCE_CLASS: Record<string, string> = {
  low: "bg-app-attention-container text-app-attention",
  medium: "bg-app-warning-container text-app-warning",
  high: "bg-app-success-container text-app-success",
};

export default async function CapabilityDetailPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const { supabase, user } = await requireAuthedUser();

  const [{ data: connection }, { data: arenaAttempts }] = await Promise.all([
    supabase
      .from("github_connections")
      .select("analysis, last_scanned_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("arena_challenge_attempts")
      .select("section, correct_count, answered_count, completed_at")
      .eq("user_id", user.id)
      .eq("section", "programming_fundamentals")
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
  ]);

  const githubScan = connection?.analysis ? (connection.analysis as unknown as GithubScanResult) : null;
  const programmingAttempts: ArenaProgrammingEvidence[] = (arenaAttempts ?? []).map((a) => ({
    correctCount: a.correct_count,
    answeredCount: a.answered_count,
    completedAt: a.completed_at as string,
  }));
  const originalRepos = githubScan ? githubScan.repos.filter((r) => !r.isFork) : [];

  const profile = deriveCapabilityProfile(githubScan, connection?.last_scanned_at ?? null, programmingAttempts);
  const derivation = profile.find((c) => c.category === category);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/vault/code-dna" className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={12} />
        Back to Code DNA
      </Link>

      <h1 className="mt-3 font-lp-display text-[26px] font-semibold text-app-charcoal">{category}</h1>

      {!derivation ? (
        <div className="mt-6 rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
          <p className="font-lp-body text-[13.5px] text-app-muted">
            Not enough evidence yet for {category.toLowerCase()}. This fills in as you complete Arena challenges or
            connect a GitHub account with real, observable work in this area.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          <div className="rounded-xl border border-app-border bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className={`rounded-full px-2.5 py-1 font-lp-mono text-[11px] font-semibold ${CONFIDENCE_CLASS[derivation.confidence]}`}>
                  {derivation.confidence} confidence
                </span>
                <p className="mt-1.5 font-lp-mono text-[11px] text-app-muted">
                  {derivation.evidenceCount} evidence point{derivation.evidenceCount === 1 ? "" : "s"} ·{" "}
                  {derivation.contexts.join(" + ")}
                </p>
              </div>
              <span className="font-lp-display text-[36px] font-semibold text-app-charcoal">{derivation.score}</span>
            </div>
          </div>

          <div className="rounded-xl border border-app-border bg-white p-5">
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Why this capability?</h2>
            <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">
              {explainCapability(derivation, originalRepos)}
            </p>
          </div>

          <div className="rounded-xl border border-app-border bg-white p-5">
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Evidence</h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {derivation.contexts.includes("github") &&
                matchingRepos(category, originalRepos).map((r) => (
                  <a
                    key={r.name}
                    href={r.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-app-border p-3 hover:bg-app-background"
                  >
                    <p className="font-lp-body text-[13px] text-app-charcoal">{r.name}</p>
                    <ExternalLink size={13} className="text-app-muted" />
                  </a>
                ))}
              {derivation.contexts.includes("arena") &&
                (arenaAttempts ?? []).map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg border border-app-border p-3">
                    <Award size={14} className="shrink-0 text-app-orange" />
                    <p className="font-lp-body text-[13px] text-app-charcoal">
                      {SECTION_LABEL[a.section as keyof typeof SECTION_LABEL] ?? a.section} — {a.correct_count}/{a.answered_count} correct on{" "}
                      {new Date(a.completed_at as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
