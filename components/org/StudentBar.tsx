import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skillstudio", label: "SkillStudio" },
  { href: "/arena", label: "Arena" },
  { href: "/pulse", label: "Pulse" },
];

/** Shown on a college's public page to a signed-in student, so opening it from Pulse never strands them outside the app. */
export function StudentBar() {
  return (
    <nav aria-label="Capabilio" className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-app-border bg-[#fff]/90 px-4 py-2.5 backdrop-blur">
      <Link href="/pulse" className="o-btn-ghost !h-9 !px-3">
        <ArrowLeft size={14} aria-hidden="true" /> Back to Pulse
      </Link>
      <ul className="ml-auto flex items-center gap-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-app-muted transition-colors hover:bg-app-background hover:text-app-charcoal">{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
