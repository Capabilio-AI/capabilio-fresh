import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { ChallengeWheel } from "@/components/arena/ChallengeWheel";

export const metadata: Metadata = { title: "Weekly Wheel (preview) — Arena — Capabilio AI" };

export default async function WheelPreviewPage() {
  await requireAuthedUser();
  return (
    <div>
      <Link href="/arena/challenges/stream" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-[var(--m-ink)]">
        <ArrowLeft size={14} /> Stream Challenges
      </Link>
      <p className="mt-2 font-lp-body text-[12px] text-app-muted">Preview only: the result is kept in this browser. Nothing here changes your real challenges.</p>
      <div className="pt-4"><ChallengeWheel /></div>
    </div>
  );
}
