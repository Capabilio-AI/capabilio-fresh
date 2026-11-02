import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MetroScope } from "@/components/metro/MetroScope";
import { RecruiterPackView } from "@/components/recruiter/RecruiterPackView";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRecruiterPack } from "@/lib/recruiter/shares";

export const dynamic = "force-dynamic"; // a live, revocable link: never serve a cached copy
export const metadata: Metadata = { title: "Candidate evidence — Capabilio AI", robots: { index: false, follow: false } };

/**
 * A pack a student shared with one recruiter. The token in the link is the permission; there is no sign-in. An unknown link is a 404. An expired or
 * revoked link says so and shows nothing about the candidate.
 */
export default async function RecruiterSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadRecruiterPack(createServiceClient(), token);
  if (!result) notFound();

  if (result.state !== "active") {
    return (
      <MetroScope>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-lp-display text-[26px] font-bold text-[var(--m-ink)]">{result.state === "revoked" ? "This link has been withdrawn" : "This link has expired"}</h1>
          <p className="mt-3 font-lp-body text-[15px] text-[var(--m-muted)]">Ask the candidate to send a new link if you would still like to see their work.</p>
        </div>
      </MetroScope>
    );
  }
  return (
    <MetroScope>
      <RecruiterPackView pack={result.pack} token={token} />
    </MetroScope>
  );
}
