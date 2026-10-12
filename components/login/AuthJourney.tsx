"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BarChart3, BookOpen, ClipboardCheck, Cog, Crown, FolderCheck, Handshake, ListChecks, Network, ShieldCheck, Sparkles, UserCheck, Users, Zap, type LucideIcon } from "lucide-react";
import type { ShellPath } from "@/lib/onboarding/auth-path";

type Step = { label: string; icon: LucideIcon };

const JOURNEYS: Record<ShellPath, Step[]> = {
  student: [
    { label: "Assess", icon: ClipboardCheck },
    { label: "Learn", icon: BookOpen },
    { label: "Practice", icon: Zap },
    { label: "Build", icon: Cog },
    { label: "Prove", icon: ListChecks },
    { label: "Get hired", icon: Handshake },
  ],
  professional: [
    { label: "Join the list", icon: ClipboardCheck },
    { label: "Early access", icon: Sparkles },
    { label: "Add your work", icon: FolderCheck },
    { label: "Get verified", icon: BadgeCheck },
  ],
  executive: [
    { label: "Join the list", icon: ClipboardCheck },
    { label: "Early access", icon: Sparkles },
    { label: "Build your profile", icon: UserCheck },
    { label: "Show verified leadership", icon: Crown },
  ],
  organisation: [
    { label: "Register", icon: ClipboardCheck },
    { label: "Verify", icon: UserCheck },
    { label: "Approval", icon: ShieldCheck },
    { label: "Connect", icon: Network },
    { label: "Assess", icon: Users },
    { label: "Understand", icon: BarChart3 },
  ],
};

const STEP_MS = 1900;

export function AuthJourney({ path, label }: { path: ShellPath; label: string }) {
  const steps = JOURNEYS[path];
  const [on, setOn] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setOn((n) => (n + 1) % steps.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <ol aria-label={label} className="mt-10 grid gap-1">
      {steps.map((s, n) => {
        const Icon = s.icon;
        const active = n === on;
        const done = n < on;
        return (
          <li key={s.label} className="relative flex items-center gap-4 py-1.5">
            {n < steps.length - 1 && (
              <span aria-hidden="true" className="absolute left-[19px] top-11 h-[calc(100%-1.25rem)] w-px bg-cap-ink/15">
                <span className={`block h-full w-full origin-top bg-cap-orange transition-transform duration-500 ${done ? "scale-y-100" : "scale-y-0"}`} />
              </span>
            )}
            <span
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all duration-300 ${
                active ? "scale-110 border-cap-orange! bg-cap-orange text-cap-ink" : done ? "border-cap-orange/50! bg-cap-peach text-cap-orange" : "border-cap-ink/15! bg-white/70 text-cap-muted"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {active && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-xl border border-cap-orange/60!" />}
            </span>
            <span className={`text-[15px] font-semibold transition-colors ${active ? "text-cap-ink" : "text-cap-ink/60"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
