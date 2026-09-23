import Image from "next/image";
import Link from "next/link";
import { PRIMARY_NAV, UTILITY_NAV } from "@/lib/nav/config";
import { isStageUnlocked } from "@/lib/journey/stage";
import { NavLink } from "@/components/shell/NavLink";

export function SidebarContent({ year, onNavigate }: { year: string | null; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-6">
        <Image
          src="/logo-mark.jpg"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded object-cover"
        />
        <span className="font-lp-display text-[15px] font-semibold tracking-tight text-white">
          Capabilio <span className="text-app-orange">AI</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            locked={item.lockedUntilStage ? !isStageUnlocked(year, item.lockedUntilStage) : false}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-white/10 px-3 py-4" aria-label="Utility">
        {UTILITY_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ year }: { year: string | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] shrink-0 bg-app-charcoal lg:block">
      <SidebarContent year={year} />
    </aside>
  );
}
