"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import type { Stage } from "./AssessScope";
import { Stepper } from "./Stepper";

export interface BackAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

/**
 * The room's chrome. Back is ALWAYS here and always says where it goes ("Back to role", "Back to dashboard", "Save & exit" mid-run,
 * where the honest answer is that answered questions are final and cannot be revisited).
 */
export function AssessTopBar({ stage, back, trailing }: { stage: Stage; back: BackAction | null; trailing?: ReactNode }) {
  const inner = back && (
    <>
      <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
      <span>{back.label}</span>
    </>
  );
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="a-glass mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-2.5 py-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1">
          {back &&
            (back.href ? (
              <Link href={back.href} className="group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-bold text-[var(--m-ink)] transition-colors hover:bg-white/70">{inner}</Link>
            ) : (
              <button type="button" onClick={back.onClick} className="group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-bold text-[var(--m-ink)] transition-colors hover:bg-white/70">{inner}</button>
            ))}
          <span className="ml-1 hidden font-lp-display text-[17px] font-bold tracking-tight text-[var(--m-ink)] lg:inline">Capabilio<span className="text-[var(--m-accent)]"> AI</span></span>
        </div>
        <Stepper current={stage} />
        <div className="flex min-w-[2.5rem] justify-end">{trailing}</div>
      </div>
    </header>
  );
}

export function ExitButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick} icon={<LogOut className="h-4 w-4" aria-hidden />} className="!px-3.5 !py-2">
      <span className="hidden sm:inline">Save &amp; exit</span>
      <span className="sm:hidden sr-only">Save and exit</span>
    </Button>
  );
}
