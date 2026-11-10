import type { ReactNode } from "react";
import { IntegrityGuard } from "@/components/integrity/IntegrityGuard";

/** Every page here is the student's own work, so copy, paste and screenshots are guarded. */
export default function Layout({ children }: { children: ReactNode }) {
  return <IntegrityGuard area="arena">{children}</IntegrityGuard>;
}
