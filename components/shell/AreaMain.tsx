"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Which room of the app a path belongs to; each room has its own palette (see metro.css). The dashboard uses the universal one. */
export function areaOf(pathname: string): "arena" | "studio" | "pulse" | "roadmap" | undefined {
  if (pathname.startsWith("/arena")) return "arena";
  if (pathname.startsWith("/skillstudio")) return "studio";
  if (pathname.startsWith("/pulse")) return "pulse";
  if (pathname.startsWith("/dashboard/roadmap")) return "roadmap";
  return undefined;
}

export function AreaMain({ children }: { children: ReactNode }) {
  const area = areaOf(usePathname());
  return (
    <div data-area={area} className="min-h-[calc(100vh-7rem)] bg-[var(--m-ground)] transition-colors duration-300 motion-reduce:transition-none">
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
