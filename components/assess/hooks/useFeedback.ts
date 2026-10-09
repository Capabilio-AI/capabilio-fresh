"use client";

import { useEffect, useState } from "react";
import type { StoredFeedback } from "@/lib/assess/feedback";
import { assessApi, sleep } from "../api";

/** Polls the stored feedback until it exists. The server guarantees an answer (AI or template) within its patience window. */
export function useFeedback(sessionId: string) {
  const [feedback, setFeedback] = useState<StoredFeedback[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 45 && !cancelled; i++) {
        try {
          const r = await assessApi.feedback(sessionId);
          if (r.status === "READY") return void (!cancelled && setFeedback(r.feedback));
        } catch { /* keep trying: the popup already has its numbers */ }
        await sleep(i < 5 ? 1200 : 2500);
      }
      if (!cancelled) setFailed(true);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);
  return { feedback, failed };
}
