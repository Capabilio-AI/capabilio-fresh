import type { ReactNode } from "react";
import { keepProfessionalOut } from "@/lib/stage/guard";

/** The student and graduate Pulse. A working professional has their own, at /professional/pulse. */
export default async function PulseLayout({ children }: { children: ReactNode }) {
  await keepProfessionalOut();
  return children;
}
