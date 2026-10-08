"use client";

import { useMemo } from "react";
import type { SubjectNode } from "@/lib/roadmap-visual/syllabus-map";
import { buildSubjectsTree, roadmapKeyOf } from "@/lib/roadmap-visual/subjects-tree";
import { RoadmapCanvas } from "./RoadmapCanvas";

/**
 * The student's college subjects drawn like the career roadmap: semesters on the trunk, each subject a line, and the career topics it teaches as
 * stations. A station fills in when real evidence (Arena, projects) proves the topic, so the tree shows which subjects to put effort into.
 */
export function SubjectsTree({ syllabus, careerName, onOpenTopic }: { syllabus: SubjectNode[]; careerName: string; onOpenTopic: (nodeKey: string) => void }) {
  const tree = useMemo(() => buildSubjectsTree(syllabus), [syllabus]);
  const handlers = useMemo(() => ({ selected: null, matches: null, onSelect: (key: string) => { const k = roadmapKeyOf(key); if (k) onOpenTopic(k); } }), [onOpenTopic]);
  if (tree.nodes.length === 0) return null;

  return (
    <section aria-labelledby="subjects-h" className="space-y-4 rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <div>
        <h2 id="subjects-h" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Your college subjects, mapped to {careerName}</h2>
        <p className="mt-1 max-w-[70ch] font-lp-body text-[14px] text-app-muted">Each branch is a subject you study. Its stations are the career topics that subject teaches. Filled stations are proven by your Arena work and projects, so put your effort where stations are still open.</p>
      </div>

      {tree.focus.length > 0 && (
        <ul aria-label="Subjects to focus on" className="grid gap-3 sm:grid-cols-3">
          {tree.focus.map((f, i) => (
            <li key={f.courseId} className="rounded-xl bg-[var(--m-ink)] p-4 text-white">
              <p className="text-[12.5px] font-bold text-[var(--m-soft)]">{i === 0 && f.timing === "CURRENT" ? "Focus now" : f.timing === "COMPLETED" ? "Worth revisiting" : "Coming up"} · {f.semesterLabel}</p>
              <p className="mt-1 font-lp-display text-[18px] font-bold leading-snug">{f.title}</p>
              <p className="mt-1 text-[13px] text-white/75">{f.toProve} {f.toProve === 1 ? "topic" : "topics"} still to prove</p>
            </li>
          ))}
        </ul>
      )}

      <div className="hidden lg:block">
        <RoadmapCanvas graph={tree} handlers={handlers} countLabel="proven" label="College subjects mapped to career topics" caption={(n) => n.description || "Semester"} />
      </div>
      {tree.untracked > 0 && <p className="font-lp-body text-[12.5px] text-app-muted">{tree.untracked} other {tree.untracked === 1 ? "subject is" : "subjects are"} part of your degree but teach none of this career&apos;s topics, so {tree.untracked === 1 ? "it isn't" : "they aren't"} drawn.</p>}
    </section>
  );
}
