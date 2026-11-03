import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { MAX_ATTEMPTS } from "@/lib/code-dna/defend-repo";
import { ExplainRepoPanel } from "@/components/vault/ExplainRepoPanel";

export const metadata: Metadata = { title: "Explain your project — Capabilio AI" };

export default async function ExplainRepoPage({ params }: { params: Promise<{ repo: string }> }) {
  const { repo: rawRepo } = await params;
  const repoName = decodeURIComponent(rawRepo);
  const { supabase, user } = await requireAuthedUser();

  const { data: repo } = await supabase.from("github_repositories").select("name, full_name, description, is_fork, scan_status, candidate_commit_count").eq("user_id", user.id).eq("name", repoName).maybeSingle();
  if (!repo || repo.is_fork || repo.scan_status === "failed" || repo.candidate_commit_count === 0) notFound();

  const { data: defense } = await supabase.from("github_repo_defenses").select("score, attempts").eq("user_id", user.id).eq("full_name", repo.full_name).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/vault/code-dna" className="flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={12} /> Back to Code DNA
      </Link>
      <h1 className="mt-3 font-lp-display text-[28px] font-bold leading-tight text-[var(--m-ink)]">Explain {repo.name}</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        You&rsquo;ll get 4 questions written from this project&rsquo;s own code. Answer in your own words; recruiters see the result next to your GitHub. It supports your portfolio, it doesn&rsquo;t prove authorship by itself. Two tries, with fresh questions on the second.
      </p>
      <ExplainRepoPanel repo={repo.name} initialBest={defense?.score ?? null} attemptsUsed={defense?.attempts ?? 0} maxAttempts={MAX_ATTEMPTS} />
    </div>
  );
}
