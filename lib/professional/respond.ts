import { AssessError } from "@/lib/assess/types";
import type { Result } from "./workspace-server";

/** A failed Result becomes the JSON error the screens already understand. */
export function unwrap(r: Result): { ok: true } {
  if (!r.ok) throw new AssessError("REJECTED", r.message, r.status);
  return { ok: true };
}
