import { ReactNode } from "react";
import Image from "next/image";
import { BrandPanel } from "./BrandPanel";
import type { AuthPath } from "@/lib/onboarding/auth-path";

export function AuthLayout({ children, path = "student" }: { children: ReactNode; path?: AuthPath }) {
  return (
    <div className="min-h-screen bg-lp-background lg:grid lg:grid-cols-2">
      <div className="hidden border-r border-lp-border-hairline lg:block">
        <BrandPanel path={path} />
      </div>

      <div className="lp-bg-grid relative flex min-h-screen flex-col items-center justify-center bg-lp-surface-subtle px-5 py-12 sm:px-8">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <Image
            src="/logo-mark.jpg"
            alt="Capabilio AI"
            width={32}
            height={32}
            className="h-8 w-8 rounded object-cover"
            priority
          />
          <span className="font-lp-display text-base font-semibold tracking-tight text-lp-text-ink">
            Capabilio <span className="text-lp-accent-ochre">AI</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
