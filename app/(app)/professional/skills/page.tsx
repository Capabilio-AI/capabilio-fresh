import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { listSkills } from "@/lib/professional/workspace-server";
import { ProTabs } from "@/components/professional/home/ProTabs";
import { SkillGraph } from "@/components/professional/skills/SkillGraph";

export const metadata: Metadata = { title: "Skill graph — Capabilio AI" };

/** The professional's skills, grouped by area and tied to the jobs they were used in. */
export default async function ProfessionalSkills() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const data = await listSkills(user.id).catch((e: Error) => {
    console.error("[professional/skills] load failed:", e.message);
    return null;
  });
  return (
    <div className="flex flex-col gap-5">
      <ProTabs />
      {data ? <SkillGraph skills={data.skills} jobs={data.jobs} /> : <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-ink)]">Your skill graph could not load right now. Please try again in a moment.</p>}
    </div>
  );
}
