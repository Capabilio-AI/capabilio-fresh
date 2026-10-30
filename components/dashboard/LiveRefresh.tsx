"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MIN_GAP_MS = 60_000;

/** Re-reads the page's live data when the student comes back to the tab (after an Arena mission, an assessment, a project), at most once a minute. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);
  return null;
}
