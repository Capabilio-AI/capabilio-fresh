"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface State {
  state: "RUNNING" | "DONE";
  total: number;
  outcomesPending: number;
  skillsPending: number;
  unitsPending: number;
}

/**
 * The college only uploads a syllabus. This card shows Capabilio analysing it (outcomes where the syllabus prints none, skills per course and unit),
 * keeps the analysis going while the page is open, and offers a one-click publish when it is done. Review stays available, but optional.
 */
export function AutoAnalysis({ importId, initial, published }: { importId: string; initial: Partial<State> | null; published: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Partial<State> | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const done = published || state?.state === "DONE";

  // Keeps the analysis moving while the page is open: each call does a bounded amount of work and reports where it stands.
  useEffect(() => {
    if (published || initial?.state === "DONE") return;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/admin/curriculum/imports/${importId}/enrich`, { method: "POST" });
          const body = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (!res.ok) {
            setError(body.error ?? "The analysis could not continue.");
            await new Promise((r) => setTimeout(r, 8000));
            continue;
          }
          setError(null);
          setState(body);
          if (body.state === "DONE") return void router.refresh();
        } catch {
          if (cancelled) return;
          setError("Could not reach the server. We'll keep trying while this page is open.");
          await new Promise((r) => setTimeout(r, 8000));
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importId, published, initial?.state, router]);

  async function publish() {
    setPublishing(true);
    setError(null);
    const res = await fetch(`/api/admin/curriculum/imports/${importId}/quick-publish`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setPublishing(false);
    if (!res?.ok) return setError(body.error ?? "Could not publish.");
    router.push("/org/curriculum");
    router.refresh();
  }

  if (published) return null;
  const left = (state?.outcomesPending ?? 0) + (state?.skillsPending ?? 0) + (state?.unitsPending ?? 0);
  return (
    <section aria-label="Syllabus analysis" className="rounded-xl border border-app-border bg-white p-5">
      <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">{done ? "Your syllabus has been analysed" : "Capabilio is analysing your syllabus"}</h2>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        {done
          ? "Learning outcomes were taken from the syllabus where it prints them and derived by Capabilio where it does not (always labelled as derived), and the skills each course and unit builds were identified. You don't have to enter anything. Publish when you're ready; reviewing the details first is optional."
          : `Reading ${state?.total ?? "your"} subjects: deriving learning outcomes where the syllabus has none, and identifying the skills each course and unit builds. ${left > 0 ? `${left} steps left.` : ""} You can leave this page open or come back later.`}
      </p>
      {!done && <p className="mt-3 flex items-center gap-2 font-lp-body text-[13px] text-app-charcoal"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Working…</p>}
      {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-rose">{error}</p>}
      {done && (
        <button type="button" onClick={publish} disabled={publishing} className="o-btn mt-4">
          {publishing ? "Publishing…" : "Publish curriculum to students"}
        </button>
      )}
    </section>
  );
}
