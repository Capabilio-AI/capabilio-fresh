import type { SupabaseClient } from "@supabase/supabase-js";
import { TRACKS } from "@/lib/languages";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { isProven } from "@/lib/languages/module-gate";
import { trackEvidence } from "./credential";
import { listForUser, type StoredCredential } from "./store";

export interface Wallet {
  issued: StoredCredential[];
  /** courses fully proven that the student has not claimed yet */
  claimable: { key: string; title: string }[];
  /** courses with some modules proven, and how many of how many */
  inProgress: { key: string; title: string; proven: number; total: number }[];
}

/** What the student holds, what they can claim now, and how far they are in the rest. Every number comes from the server's own proof records. */
export async function loadWallet(service: SupabaseClient, userId: string): Promise<Wallet> {
  const issued = await listForUser(service, userId);
  const have = new Set(issued.map((c) => c.subject));
  const claimable: Wallet["claimable"] = [];
  const inProgress: Wallet["inProgress"] = [];
  await Promise.all(TRACKS.map(async (t) => {
    if (have.has(t.key)) return;
    const proofs = await loadModuleProofs(service, userId, t.key);
    if (trackEvidence(t, proofs).ok) { claimable.push({ key: t.key, title: t.title }); return; }
    const proven = t.modules.filter((m) => proofs[m.key] && isProven(t, m, proofs[m.key])).length;
    if (proven > 0) inProgress.push({ key: t.key, title: t.title, proven, total: t.modules.length });
  }));
  const order = new Map(TRACKS.map((t, i) => [t.key, i]));
  const byTrack = (a: { key: string }, b: { key: string }) => (order.get(a.key as never) ?? 0) - (order.get(b.key as never) ?? 0);
  return { issued, claimable: claimable.sort(byTrack), inProgress: inProgress.sort(byTrack) };
}
