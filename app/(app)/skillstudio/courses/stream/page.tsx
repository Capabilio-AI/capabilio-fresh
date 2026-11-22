import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";
import { streamOf, STREAM_SUGGESTIONS, type Stream } from "@/lib/explore/stream";
import { loadRoleRows } from "@/lib/courses/roles-db";
import { AreaRoles } from "@/components/courses/AreaRoles";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Courses for your branch | SkillStudio | Capabilio AI" };

const BRANCHES: Exclude<Stream, "it" | "other">[] = ["ece", "eee", "mech", "civil"];
const isBranch = (v: string | undefined): v is (typeof BRANCHES)[number] => BRANCHES.some((b) => b === v);

/** Courses for the student's own branch: Electronics, Electrical, Mechanical or Civil. The branch can be changed with the tabs, so a student can also look at another. */
export default async function StreamCoursesPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const direction = await getStudentDirection(service, user.id);
  const mine = streamOf(direction?.branch ?? null);
  const asked = (await searchParams).branch;
  const selected = isBranch(asked) ? asked : isBranch(mine) ? mine : null;
  let rows: Awaited<ReturnType<typeof loadRoleRows>> = [];
  try { rows = await loadRoleRows(service); } catch (e) { console.error("[courses/stream] roles unavailable:", e instanceof Error ? e.message : e); }

  const tabs = (
    <nav aria-label="Choose a branch" className="mt-5">
      <ul className="flex flex-wrap gap-2">
        {BRANCHES.map((b) => (
          <li key={b}><Link href={`/skillstudio/courses/stream?branch=${b}`} aria-current={selected === b ? "page" : undefined}
            className={clsx("inline-flex rounded-full border px-4 py-2.5 text-[14.5px] font-bold", selected === b ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] bg-white text-[var(--m-ink)] hover:border-[var(--m-ink)]")}>{STREAM_SUGGESTIONS[b].label}</Link></li>
        ))}
      </ul>
    </nav>
  );
  const banner = mine === "it"
    ? <p className="mt-5 max-w-[62ch] rounded-xl bg-[var(--m-ground)] p-4 text-[14.5px] text-[var(--m-ink)]">Your branch is CSE / IT, so your main courses are in <Link href="/skillstudio/courses/it" className="font-bold underline">IT skills</Link>. You can still look at another branch here.</p>
    : selected === null ? <p className="mt-5 max-w-[62ch] rounded-xl bg-[var(--m-ground)] p-4 text-[14.5px] text-[var(--m-ink)]">Choose your branch above to see the jobs and courses for it.</p> : null;

  return <AreaRoles title="Courses for your branch" intro="Pick your branch to see the jobs it leads to and what to learn for each one." suggestion={selected ? STREAM_SUGGESTIONS[selected] : null} rows={rows} languageKey={selected} tabs={tabs} banner={banner} />;
}
