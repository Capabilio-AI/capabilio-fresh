import Link from "next/link";
import { GraduationCap, Home, MessageCircle, UserCheck, Users } from "lucide-react";
import clsx from "clsx";
import { UnreadBadge } from "@/components/messages/UnreadBadge";

export type PulseTab = "for-you" | "following" | "communities" | "mentors";
export const PULSE_TABS: { key: PulseTab; label: string; icon: typeof Home; soon?: boolean }[] = [
  { key: "for-you", label: "For You", icon: Home },
  { key: "following", label: "Following", icon: UserCheck },
  { key: "communities", label: "Communities", icon: Users, soon: true },
  { key: "mentors", label: "Mentors", icon: GraduationCap, soon: true },
];

const href = (key: PulseTab) => (key === "for-you" ? "/pulse" : `/pulse?tab=${key}`);

/** Vertical on large screens (left rail), a scrolling tab strip on small ones. Tabs are real URLs, so they can be shared and the back button works. */
export function PulseNav({ active, variant }: { active: PulseTab; variant: "rail" | "strip" }) {
  const items = [...PULSE_TABS, ...(variant === "rail" ? [{ key: "messages" as const, label: "Messages", icon: MessageCircle, soon: false }] : [])];
  return (
    <nav aria-label="Pulse sections" className={variant === "rail" ? "flex flex-col gap-1" : "-mx-4 flex gap-1 overflow-x-auto border-b border-app-border bg-white px-4 sm:mx-0 sm:rounded-2xl sm:border sm:px-2"}>
      {items.map(({ key, label, icon: Icon, soon }) => {
        const isActive = key === active;
        const inner = (
          <>
            <Icon size={variant === "rail" ? 17 : 15} aria-hidden="true" className={isActive ? "text-app-orange" : "text-app-muted"} />
            <span>{label}</span>
            {soon && <span className="rounded-full bg-app-background px-1.5 py-0.5 font-lp-mono text-[9.5px] text-app-muted">Soon</span>}
            {variant === "strip" && isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
          </>
        );
        const cls = clsx(
          "relative flex shrink-0 items-center gap-2.5 whitespace-nowrap font-lp-body text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40",
          variant === "rail" ? "rounded-xl px-3 py-2.5" : "px-3.5 py-3",
          variant === "rail" && isActive ? "bg-app-orange-container text-app-charcoal" : isActive ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal",
          variant === "rail" && !isActive && "hover:bg-app-background"
        );
        return key === "messages" ? (
          <Link key={key} href="/pulse/messages" className={cls}>{inner}<UnreadBadge className="ml-auto h-[18px]" /></Link>
        ) : (
          <Link key={key} href={href(key as PulseTab)} aria-current={isActive ? "page" : undefined} className={cls}>{inner}</Link>
        );
      })}
    </nav>
  );
}
