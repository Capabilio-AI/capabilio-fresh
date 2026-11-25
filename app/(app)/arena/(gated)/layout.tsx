import type { ReactNode } from "react";
import { requireArenaOpen } from "@/lib/stage/guard";

/** A 1st year with no role starts with Explore roles; common challenges open at 2nd year. Course proofs (/arena/prove) are outside this gate on purpose. */
export default async function Layout({ children }: { children: ReactNode }) {
  await requireArenaOpen();
  return children;
}
