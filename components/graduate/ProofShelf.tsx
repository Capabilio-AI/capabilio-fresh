import { BadgeWall } from "@/components/passport/badge/BadgeWall";
import type { GraduateHomeData } from "@/lib/graduate/home";

/** Every skill the role asks for, as a medallion: earned ones in colour, the rest waiting. Tap one to hold it and see the work behind it. */
export function ProofShelf({ proof, roleName }: { proof: GraduateHomeData["proof"]; roleName: string | null }) {
  const { earned, practising, total } = proof;
  const toStart = Math.max(0, total - earned - practising);
  return (
    <section aria-labelledby="shelf-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="shelf-h" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Your proof shelf{roleName ? ` for ${roleName}` : ""}</h2>
        <p className="font-lp-body text-[13px] text-[var(--m-muted)]">{total === 0 ? "Appears after your assessment" : `${earned} proven · ${practising} in progress · ${toStart} to start`}</p>
      </div>
      {total === 0 ? (
        <p className="mt-3 max-w-[60ch] font-lp-body text-[14px] leading-relaxed text-[var(--m-muted)]">Take the career assessment and the skills this role asks for will line up here. Each becomes a badge when you prove it with work.</p>
      ) : (
        <>
          <div className="mt-4"><BadgeWall skills={proof.skills} audience="owner" compact /></div>
          <p className="mt-2 max-w-[70ch] font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">Badges come from verified Arena tickets, projects, GitHub and mentor reviews. Your assessment sets where you start and never earns one.</p>
        </>
      )}
    </section>
  );
}
