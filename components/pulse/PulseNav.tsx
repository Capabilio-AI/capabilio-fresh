import Link from "next/link";
import { Flame, GraduationCap, Home, MessageCircle, UserCheck, Users } from "lucide-react";
import clsx from "clsx";
import { UnreadBadge } from "@/components/messages/UnreadBadge";
import { GlassTabs } from "@/components/metro/GlassTabs";

export type PulseTab = "for-you" | "following" | "trending" | "communities" | "mentors";
export const PULSE_TABS: { key: PulseTab; label: string; icon: typeof Home; soon?: boolean }[] = [
  { key: "for-you", label: "For You", icon: Home },
  { key: "following", label: "Following", icon: UserCheck },
  { key: "trending", label: "Trending", icon: Flame },
  { key: "communities", label: "Communities", icon: Users },
  { key: "mentors", label: "Mentors", icon: GraduationCap },
];

const href = (key: PulseTab) => (key === "for-you" ? "/pulse" : `/pulse?tab=${key}`);

/** A frosted-glass rail on large screens, a glass tab bar on small ones. Tabs are real URLs, so they can be shared and the back button works. */
export function PulseNav({ active, variant }: { active: PulseTab; variant: "rail" | "strip" }) {
  if (variant === "strip") {
    return <GlassTabs label="Pulse sections" sticky={false} tabs={[...PULSE_TABS.map((t) => ({ label: t.label, href: href(t.key), active: t.key === active })), { label: "Messages", href: "/pulse/messages", active: false }]} />;
  }
  const items = [...PULSE_TABS, { key: "messages" as const, label: "Messages", icon: MessageCircle, soon: false }];
  return (
    <nav aria-label="Pulse sections" className="glass flex flex-col gap-1 rounded-3xl p-2">
      {items.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const cls = clsx(
          "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent-ink)] motion-reduce:transition-none",
          isActive ? "glass-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-white/55 hover:text-[var(--m-ink)]"
        );
        const inner = (<><Icon size={17} aria-hidden="true" /><span>{label}</span></>);
        return key === "messages" ? (
          <Link key={key} href="/pulse/messages" className={cls}>{inner}<UnreadBadge className="ml-auto h-[18px]" /></Link>
        ) : (
          <Link key={key} href={href(key as PulseTab)} aria-current={isActive ? "page" : undefined} className={cls}>{inner}</Link>
        );
      })}
    </nav>
  );
}
