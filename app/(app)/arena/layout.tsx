import type { ReactNode } from "react";
import { keepProfessionalOut } from "@/lib/stage/guard";
import { IntegrityGuard } from "@/components/integrity/IntegrityGuard";

/** Every page here is the student's own work, so copy, paste and screenshots are guarded. The Arena-open rule lives in (gated)/layout.tsx so a course proof stays reachable. */
export default async function Layout({ children }: { children: ReactNode }) {
  await keepProfessionalOut(); // professionals have their own pages
  return <IntegrityGuard area="arena">{children}</IntegrityGuard>;
}
