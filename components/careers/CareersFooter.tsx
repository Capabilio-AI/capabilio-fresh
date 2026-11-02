import Image from "next/image";
import Link from "next/link";
import { CAREERS_EMAIL, mailtoFor } from "@/lib/hiring/content";

export default function CareersFooter() {
  return (
    <footer className="crit-ink bg-[var(--crit-ink)] px-5 py-10 text-white md:px-10">
      <div className="mx-auto flex max-w-[84rem] flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Image src="/brand/icon-dark.png" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="text-[0.95rem] font-extrabold tracking-tight" style={{ fontStretch: "112%" }}>Capabilio</span>
          <span className="text-sm text-white/60">Proof, not resumes.</span>
        </div>
        <ul className="flex flex-wrap gap-x-7 gap-y-2 text-sm font-semibold text-white/70">
          <li><Link href="/careers#roles" className="hover:text-white">Open roles</Link></li>
          <li><Link href="/careers#introduce" className="hover:text-white">Introduce yourself</Link></li>
          <li><a href={mailtoFor("Profile and portfolio")} className="hover:text-white">{CAREERS_EMAIL}</a></li>
          <li><Link href="/" className="hover:text-white">Main site</Link></li>
        </ul>
        <span className="text-xs text-white/45">© 2026 Capabilio AI</span>
      </div>
    </footer>
  );
}
