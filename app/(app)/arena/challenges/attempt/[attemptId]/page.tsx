import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ChallengeAttemptError, loadAttemptView } from "@/lib/arena-challenges/attempts";
import { AttemptWorkspace } from "@/components/arena/attempt/AttemptWorkspace";

export const metadata: Metadata = { title: "Challenge — Arena — Capabilio AI" };

/** One challenge attempt. Owner-only: the view is loaded for the signed-in student, so another student's attempt id is a 404. */
export default async function ChallengeAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { user } = await requireAuthedUser();
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  const view = await loadAttemptView(createServiceClient(), user.id, attemptId).catch((error) => {
    if (error instanceof ChallengeAttemptError && error.status === 404) notFound();
    throw error;
  });
  return <AttemptWorkspace initial={view} />;
}
