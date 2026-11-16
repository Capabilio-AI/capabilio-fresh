import type { ReactNode } from "react";
import { keepProfessionalOut, requireArenaOpen } from "@/lib/stage/guard";
import { IntegrityGuard } from "@/components/integrity/IntegrityGuard";

/** Every page here is the student's own work, so copy, paste and screenshots are guarded. */
export default async function Layout({ children }: { children: ReactNode }) {
  await keepProfessionalOut(); // professionals have their own pages
  await requireArenaOpen(); // a 1st year with no role starts with Explore roles; common challenges open at 2nd year
  return <IntegrityGuard area="arena">{children}</IntegrityGuard>;
}
