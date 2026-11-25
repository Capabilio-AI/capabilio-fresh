import { DS_LEVEL_1 } from "./data-scientist";
import type { RoleLesson } from "./types";

/** Hand-written lessons by role (the career key). A role without an entry has none yet; its path page says so by showing nothing, never a button that leads nowhere. */
export const ROLE_LESSONS: Readonly<Record<string, readonly RoleLesson[]>> = { "data-scientist": DS_LEVEL_1 };

export const lessonsOfRole = (roleKey: string): readonly RoleLesson[] => ROLE_LESSONS[roleKey] ?? [];
export const findRoleLesson = (roleKey: string, lessonKey: string): RoleLesson | undefined => lessonsOfRole(roleKey).find((l) => l.key === lessonKey);
