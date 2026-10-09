"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page's live data whenever the student comes back to the tab (after an Arena mission, an assessment, a project). */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);
  return null;
}
