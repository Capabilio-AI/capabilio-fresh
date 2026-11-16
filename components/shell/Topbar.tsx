import Image from "next/image";
import Link from "next/link";
import { Bell, MessageCircle, Search, Settings } from "lucide-react";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { DockButton } from "@/components/shell/DockButton";
import { UnreadBadge } from "@/components/messages/UnreadBadge";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import type { CareerStage } from "@/lib/stage/stage";

export function Topbar({ viewer, stage, alerts = 0 }: { viewer: ViewerSummary; stage: CareerStage; alerts?: number }) {
  // A working professional has their own pages: the student network's search, messages and alerts are not shown to them.
  const pro = stage === "professional";
  return (
    <header className="sticky top-0 z-30 bg-[var(--m-ground)] print:hidden">
      <div className="mx-auto flex h-[64px] max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={pro ? "/professional" : "/dashboard"} aria-label="Capabilio AI, home" className="flex shrink-0 items-center">
          <Image src="/brand/capabilio-logo.png" alt="Capabilio AI" width={1130} height={234} priority className="h-[42px] w-auto sm:h-[48px]" />
        </Link>

        <div className="min-w-0 flex-1" />
        {!pro && <GlobalSearch />}
        {!pro && <Link href="/pulse/search" aria-label="Search" className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--m-ink)] md:hidden"><Search size={17} /></Link>}
        <div className="min-w-0 flex-1" />

        <div className="glass flex shrink-0 items-center gap-0.5 rounded-full p-1">
          {!pro && <DockButton href="/pulse/messages" label="Messages" badge={<UnreadBadge className="absolute -right-2.5 -top-2 h-[18px]" />}><MessageCircle size={18} strokeWidth={2.2} /></DockButton>}
          {!pro && <DockButton href="/notifications" label="Alerts" badge={<NotificationBadge className="absolute -right-2.5 -top-2 h-[18px]" />}><Bell size={18} strokeWidth={2.2} /></DockButton>}
          {pro && <DockButton href="/professional/notifications" label={alerts > 0 ? `Alerts, ${alerts} unread` : "Alerts"} badge={alerts > 0 ? <span aria-hidden className="absolute -right-2.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--m-accent)] px-1 text-[11px] font-bold text-white">{alerts > 9 ? "9+" : alerts}</span> : undefined}><Bell size={18} strokeWidth={2.2} /></DockButton>}
          <DockButton href="/settings" label="Settings"><Settings size={18} strokeWidth={2.2} /></DockButton>
          <span aria-hidden className="mx-1 h-6 w-px bg-[var(--m-rule)]" />
          <AccountMenu viewer={viewer} stage={stage} />
        </div>
      </div>
    </header>
  );
}
