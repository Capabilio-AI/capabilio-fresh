"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ClipboardCheck, Compass, TrendingUp } from "lucide-react";

const STEPS = [
  { icon: BookOpen, title: "Learn now", body: "You get modules and courses for this role. Use this time to build real knowledge of it." },
  { icon: Compass, title: "3rd year: your choice", body: "We ask whether you want to continue with this role or switch to another." },
  { icon: ClipboardCheck, title: "Then a basic role assessment", body: "Your answer decides the assessment we take, and it builds your profile." },
  { icon: TrendingUp, title: "Real-world scenarios", body: "From there you get scenarios based on your role. Solve them and your portfolio grows. Get them wrong and your ELO score goes down." },
];

/** Shown once, right after a student chooses a role from Explore. Closing it removes ?welcome from the address. */
export function RoleWelcome({ role }: { role: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const close = () => router.replace(pathname, { scroll: false });

  useEffect(() => {
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.replace(pathname, { scroll: false }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="role-welcome-h" className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        <p className="font-lp-body text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--m-accent-ink)]">Your role</p>
        <h2 id="role-welcome-h" className="mt-1 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">{role} is set</h2>
        <p className="mt-2 font-lp-body text-[14.5px] leading-relaxed text-app-muted">Here is how your path works from here.</p>
        <ol className="mt-5 flex flex-col gap-4">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={18} aria-hidden /></span>
              <span>
                <span className="block font-lp-display text-[15.5px] font-bold text-[var(--m-ink)]">{title}</span>
                <span className="mt-0.5 block font-lp-body text-[14px] leading-snug text-app-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <button ref={button} type="button" onClick={close} className="mt-7 w-full rounded-full bg-[var(--m-ink)] px-5 py-3 text-[14.5px] font-bold text-white transition-transform active:scale-[0.98]">Start learning</button>
      </div>
    </div>
  );
}
