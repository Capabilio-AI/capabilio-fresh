import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Mail, School, ShieldCheck, User } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { formatAcademicYear } from "@/lib/career/academic-year";
import { EditableNameForm } from "@/components/settings/EditableNameForm";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SignOutButton } from "@/components/settings/SignOutButton";
import { getStageState } from "@/lib/stage/server";
import { planById } from "@/lib/plans/catalog";
import { FinishStudiesCard } from "@/components/stage/FinishStudiesCard";
import { JobForm } from "@/components/stage/JobForm";

export const metadata: Metadata = { title: "Account settings — Capabilio AI" };

const LINK = "font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline";

export default async function SettingsPage() {
  const { supabase, user } = await requireAuthedUser();
  const [viewer, { stage, planId, employerName, jobTitle }] = await Promise.all([getViewerSummary(supabase, user.id), getStageState(user.id)]);
  const plan = planById(planId);

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard id="profile-h" title="Profile" description="How you appear across your dashboard and Vault." bare>
        <SettingsRow icon={User} title="Full name" description="Shown across your dashboard and Vault.">
          <EditableNameForm initialName={viewer.fullName ?? ""} />
        </SettingsRow>
        <SettingsRow icon={User} title="Photo and headline" description="Manage how you appear to others.">
          <Link href="/profile" className={LINK}>Go to profile →</Link>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard id="acct-h" title="Sign-in email" bare>
        <SettingsRow icon={Mail} title={viewer.email ?? "No email on file"} description="This is the address you sign in with. To change it, contact support.">
          <Link href="/settings/security" className={LINK}>Security →</Link>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard id="acad-h" title="Academic" bare>
        <SettingsRow icon={School} title="Institution" description={viewer.collegeName ?? "Not set"} />
        <SettingsRow
          icon={GraduationCap}
          title="Branch and year"
          description={
            [viewer.branch, formatAcademicYear(viewer.direction?.academicYear?.year ?? null, viewer.direction?.startYear ?? null, viewer.direction?.endYear ?? null)].filter(Boolean).join(" · ") || "Not set"
          }
        >
          <Link href="/dashboard/vault" className={LINK}>Manage →</Link>
        </SettingsRow>
        <SettingsRow icon={GraduationCap} title="Career direction" description="Job, higher studies, entrepreneurship, or not sure yet. Change it any time.">
          <Link href="/settings/direction" className={LINK}>Open →</Link>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard id="stage-h" title="Career stage" description="Your path follows your profile. It updates by itself when your programme ends or you accept an offer." bare>
        {stage === "student" && (
          <SettingsRow icon={GraduationCap} title="Current student" description="Finished early, or your college has not updated your dates? Move to the recently graduated path now.">
            <FinishStudiesCard />
          </SettingsRow>
        )}
        {stage === "graduate" && (
          <>
            <SettingsRow icon={GraduationCap} title="Recently graduated" description={plan ? `Plan: ${plan.name}` : "No plan chosen yet"}>
              <Link href="/plans" className={LINK}>Change plan →</Link>
            </SettingsRow>
            <div className="px-5 pb-5 sm:px-6">
              <p className="mb-3 font-lp-body text-[13.5px] font-bold text-[var(--m-ink)]">Got a job? Tell us and your profile moves to the professional path.</p>
              <JobForm />
            </div>
          </>
        )}
        {stage === "professional" && (
          <SettingsRow icon={GraduationCap} title="Working professional" description={[jobTitle, employerName].filter(Boolean).join(" · ") || "Your evidence and portfolio came with you."} />
        )}
      </SettingsCard>

      <SettingsCard id="session-h" title="This session" bare>
        <SettingsRow icon={ShieldCheck} title="Sign out" description="End your session on this device.">
          <SignOutButton />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
