import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import clsx from "clsx";
import type { LadderLevel } from "@/lib/arena-roles/session/service";

const STAGE_OF_LEVEL = ["Start here", "Main skills", "Go deeper", "Get job ready"];

/** Learning is on this page; proof is in Arena. Four levels of proof, one per stage of the path, opened one after another. The open level goes straight to Arena. */
export function RoleProofPath({ roleName, levels }: { roleName: string; levels: LadderLevel[] }) {
  return (
    <section aria-labelledby="role-proof-h" className="mt-6 rounded-2xl border-2 border-[var(--m-ink)] bg-white p-5">
      <h2 id="role-proof-h" className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Prove it in Arena</h2>
      <p className="mt-1 max-w-[64ch] text-[14.5px] text-[var(--m-muted)]">Learn each stage below, then prove it on the real {roleName} workstations. Each level is a connected piece of the job on your own company data. Passing it adds the proof to your portfolio and opens the next level.</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {levels.map((l) => (
          <li key={l.specKey} className={clsx("flex flex-col gap-2 rounded-xl border p-4", l.status === "done" ? "border-[#17784a] bg-[#e8f5ee]" : l.status === "open" ? "border-[var(--m-ink)]" : "border-[var(--m-rule)] bg-[var(--m-ground)] text-[var(--m-muted)]")}>
            <p className="text-[12px] font-bold uppercase tracking-wide opacity-70">Level {l.level} · {STAGE_OF_LEVEL[l.level - 1]}</p>
            <p className="font-lp-display text-[17px] font-bold leading-tight text-[var(--m-ink)]">{l.title.replace(/^Level \d: /, "")}</p>
            {l.status === "done" && <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0f5132]"><Check size={14} aria-hidden />Proven</p>}
            {l.status === "locked" && <p className="inline-flex items-center gap-1.5 text-[13px]"><Lock size={13} aria-hidden />Opens when Level {l.level - 1} is proven</p>}
            {l.status === "open" && <Link href="/arena/challenges/domain" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-4 py-2 text-[13.5px] font-bold text-white">Open in Arena<ArrowRight size={14} aria-hidden /></Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
