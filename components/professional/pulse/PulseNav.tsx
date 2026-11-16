import Link from "next/link";
import clsx from "clsx";
import { Flame, Home, HeartHandshake, UserCheck, UserRound } from "lucide-react";
import { GlassTabs } from "@/components/metro/GlassTabs";

export type PulseTab = "everyone" | "following" | "trending" | "mentors" | "mine";
export const TABS: { key: PulseTab; label: string; icon: typeof Home }[] = [
  { key: "everyone", label: "My feed", icon: Home },
  { key: "following", label: "Following", icon: UserCheck },
  { key: "trending", label: "Trending", icon: Flame },
  { key: "mentors", label: "Mentors", icon: HeartHandshake },
  { key: "mine", label: "My posts", icon: UserRound },
];
export const hrefOf = (t: PulseTab) => (t === "everyone" ? "/professional/pulse" : `/professional/pulse?tab=${t}`);

/** The same frosted-glass rail the student Pulse uses on large screens and a glass tab bar on small ones. Tabs are real URLs, so back and share work. */
export function PulseNav({ active, variant }: { active: PulseTab; variant: "rail" | "strip" }) {
  if (variant === "strip") return <GlassTabs label="Pulse sections" sticky={false} tabs={TABS.map((t) => ({ label: t.label, href: hrefOf(t.key), active: t.key === active }))} />;
  return (
    <nav aria-label="Pulse sections" className="glass flex flex-col gap-1 rounded-3xl p-2">
      {TABS.map(({ key, label, icon: Icon }) => (
        <Link key={key} href={hrefOf(key)} aria-current={key === active ? "page" : undefined} className={clsx("flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-bold transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent-ink)] motion-reduce:transition-none", key === active ? "glass-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-white/55 hover:text-[var(--m-ink)]")}>
          <Icon size={17} aria-hidden /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
