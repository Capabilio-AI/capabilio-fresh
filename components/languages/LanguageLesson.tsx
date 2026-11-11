"use client";

import { useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { TheoryLesson } from "@/lib/skillstudio/lesson-content";
import { TheoryView } from "@/components/skillstudio/learn/TheoryView";
import type { PlaygroundLanguage } from "@/lib/playground/playground";

type Saved = "idle" | "saving" | "saved" | "failed";

/** A track lesson with its check questions; finishing the check records the lesson as done. Practice progress only. */
export function LanguageLesson({ track, lessonKey, lesson, alreadyDone }: { track: string; lessonKey: string; lesson: TheoryLesson; alreadyDone: boolean }) {
  const [saved, setSaved] = useState<Saved>(alreadyDone ? "saved" : "idle");

  async function onCheckDone(correct: number, total: number) {
    setSaved("saving");
    try {
      const res = await fetch("/api/languages/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ track, lessonKey, correct, total }) });
      setSaved(res.ok ? "saved" : "failed");
    } catch {
      setSaved("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TheoryView lesson={lesson} onCheckDone={onCheckDone} language={track as PlaygroundLanguage} practice={{ track, lessonKey }} />
      <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--m-muted)]">
        {saved === "saved" && <><CircleCheck size={16} aria-hidden className="text-[#17784a]" />Lesson complete and saved.</>}
        {saved === "saving" && "Saving your progress…"}
        {saved === "failed" && <><TriangleAlert size={16} aria-hidden />Could not save your progress. Reload this page and answer the check again.</>}
      </p>
    </div>
  );
}
