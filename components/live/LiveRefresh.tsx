"use client";

import { useRouter } from "next/navigation";
import { useLive } from "./useLive";

/** Put on a server-rendered page whose numbers come from Arena (rating, rank, skills, readiness): it re-reads the page whenever Arena changes, so nothing waits for a reload. */
export function LiveRefresh({ intervalMs = 45_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useLive(() => router.refresh(), intervalMs);
  return null;
}
