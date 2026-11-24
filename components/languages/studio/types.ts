import type { Verdict } from "@/components/skillstudio/learn/CheckYourself";

export interface PathLesson { key: string; title: string; state: "done" | "current" | "open" | "locked" }
export interface PathModule { key: string; title: string; status: "proven" | "open" | "locked"; lessons: PathLesson[]; current: boolean; testReady: boolean }
/** an answer the server already recorded, with the verdict, so it shows as answered when the learner comes back */
export type RecordedAnswer = { choice: number } & Verdict;
