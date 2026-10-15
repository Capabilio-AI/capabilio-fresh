"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import clsx from "clsx";
import { send } from "@/components/roadmap/v2/api";

/** "I am learning this": a personal marker that lifts the lesson to the top of Continue. It is a note, never proof. */
export function LearningToggle({ nodeKey, careerId, initial }: { nodeKey: string; careerId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      setError(null);
      const r = await send("PUT", "/api/roadmap/node-state", { nodeKey, careerId, status: next ? "LEARNING" : null });
      if (!r.ok) {
        setOn(!next);
        setError(r.error ?? "Could not save.");
        return;
      }
      router.refresh();
    });

  return (
    <div>
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        onClick={toggle}
        className={clsx("flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-bold transition-colors disabled:opacity-70 motion-reduce:transition-none", on ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-ink)] bg-white text-[var(--m-ink)] hover:bg-[var(--m-ground)]")}
      >
        {on ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
        {on ? "You are learning this" : "I am learning this"}
      </button>
      <p role="alert" className="mt-1.5 min-h-4 text-[12.5px] font-bold text-red-600">{error}</p>
    </div>
  );
}
