import type { AttemptView } from "@/lib/arena-challenges/attempts";
import type { ViewCheck } from "@/lib/arena-runtime/client/builders";

export type Draft = Record<string, unknown>;

export interface RuntimeProps {
  view: AttemptView;
  draft: Draft;
  /** Always pass the next draft whole (immutable update); the host autosaves it. */
  onDraft: (next: Draft) => void;
  disabled: boolean;
}

export const checksOf = (view: AttemptView, ...types: string[]): ViewCheck[] => view.checks.filter((c) => types.includes(c.type));
export const text = (v: unknown): string => (typeof v === "string" ? v : "");
export const asRecord = <T,>(v: unknown): Record<string, T> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {});
