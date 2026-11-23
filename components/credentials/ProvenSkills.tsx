import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { loadWallet } from "@/lib/credentials/wallet";
import { ClaimCredential } from "@/components/credentials/ClaimCredential";
import { ShowCodeToggle } from "@/components/credentials/ShowCodeToggle";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The student's Capabilio Proven Skills: credentials they hold, ones they can claim now, and how far they are in the others. */
export async function ProvenSkills({ userId }: { userId: string }) {
  let wallet;
  try { wallet = await loadWallet(createServiceClient(), userId); } catch (e) {
    console.error("[credentials] wallet unavailable:", e instanceof Error ? e.message : e);
    return <section className="mb-6 rounded-2xl border border-[var(--m-rule)] bg-white p-5"><h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Capabilio Proven Skills</h2><p className="mt-1 text-[14.5px] text-[var(--m-muted)]">Your proven skills could not be loaded right now. Please try again in a minute.</p></section>;
  }
  const empty = wallet.issued.length === 0 && wallet.claimable.length === 0 && wallet.inProgress.length === 0;
  return (
    <section aria-labelledby="proven" className="mb-6 rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <h2 id="proven" className="flex items-center gap-2 font-lp-display text-[24px] font-bold text-[var(--m-ink)]"><Award size={22} aria-hidden />Capabilio Proven Skills</h2>
      <p className="mt-1 max-w-[62ch] text-[14.5px] text-[var(--m-muted)]">A credential you earn by proving every module of a course: a test and a coding problem for each one. Anyone you share it with can check that it is real.</p>

      {wallet.claimable.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {wallet.claimable.map((c) => (
            <li key={c.key} className="rounded-xl border-2 border-[var(--m-ink)] p-4">
              <p className="font-lp-display text-[19px] font-bold text-[var(--m-ink)]">{c.title}: every module proven</p>
              <p className="mb-3 text-[14px] text-[var(--m-muted)]">You can claim your credential now.</p>
              <ClaimCredential track={c.key} title={c.title} />
            </li>
          ))}
        </ul>
      )}
      {wallet.issued.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {wallet.issued.map((c) => (
            <li key={c.code} className="flex flex-col rounded-xl border border-[var(--m-rule)] p-4">
              <Link href={`/verify/${c.code}`} className="group flex flex-col gap-1">
                <span className="font-lp-display text-[19px] font-bold text-[var(--m-ink)]">{c.subject_title}</span>
                <span className="text-[13px] text-[var(--m-muted)]">{c.revoked_at ? "Revoked" : "Issued"} · {day(c.issued_at)}</span>
                <span className="font-lp-mono text-[12.5px] text-[var(--m-muted)]">{c.code}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--m-accent-ink)]">Open and share<ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
              {!c.revoked_at && <ShowCodeToggle code={c.code} initial={c.show_code} />}
            </li>
          ))}
        </ul>
      )}
      {wallet.inProgress.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {wallet.inProgress.map((p) => <li key={p.key} className="text-[14.5px] text-[var(--m-ink)]"><Link href={`/skillstudio/courses/${p.key}`} className="font-bold underline">{p.title}</Link>: {p.proven} of {p.total} modules proven</li>)}
        </ul>
      )}
      {empty && <p className="mt-4 text-[14.5px] text-[var(--m-ink)]">You have no proven skills yet. Open a <Link href="/skillstudio/courses" className="font-bold underline">course</Link>, pass the test and problem of each module, and your credential appears here.</p>}
    </section>
  );
}
