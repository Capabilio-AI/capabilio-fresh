import Link from "next/link";
import { ArrowRight, BadgeCheck, Mail } from "lucide-react";
import { ChooseCareerDialog } from "@/components/direction/ChooseCareerDialog";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { SignOutButton } from "@/components/settings/SignOutButton";
import type { EducationEntry } from "@/lib/dashboard/education";
import type { VaultItem } from "@/lib/vault/data";
import type { Completeness } from "@/lib/profile/details";
import type { EditableProfile } from "./EditProfileDialog";

const CARD = "glass rounded-2xl p-5 sm:p-6";
const H2 = "font-lp-display text-[18px] font-bold text-[var(--m-ink)]";
const LINK = "font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline";
const MUTED = "font-lp-body text-[14px] text-[var(--m-muted)]";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="font-lp-body text-[13px] text-[var(--m-muted)]">{label}</dt>
      <dd className="min-w-0 break-words font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{children}</dd>
    </div>
  );
}
const Unset = ({ text = "Not set" }: { text?: string }) => <span className="font-normal text-[var(--m-off)]">{text}</span>;

export function AboutSection({ profile, aspiringFor, location, email }: { profile: EditableProfile; aspiringFor: string | null; location: string | null; email: string }) {
  return (
    <div className="flex flex-col gap-5">
      <section className={CARD} aria-labelledby="about-h">
        <h2 id="about-h" className={H2}>About</h2>
        {profile.bio ? <p className="mt-2 max-w-prose whitespace-pre-line font-lp-body text-[15px] leading-relaxed text-[var(--m-ink)]">{profile.bio}</p> : <p className={`mt-2 ${MUTED}`}>Tell people what you study, what you build and what you want next. Use “Edit profile” to write it.</p>}
      </section>
      <section className={CARD} aria-labelledby="goal-h">
        <h2 id="goal-h" className={H2}>Career goal</h2>
        <dl className="mt-1 divide-y divide-[var(--m-rule)]!">
          <Row label="Aspiring for">
            <span className="flex items-center gap-3">{aspiringFor ?? <Unset text="Not chosen yet" />}<ChooseCareerDialog label={aspiringFor ? "Change" : "Choose"} triggerClassName={LINK} /></span>
          </Row>
          <Row label="Location">{location ?? <Unset />}</Row>
          <Row label="Email"><span className="inline-flex items-center gap-1.5"><Mail size={14} aria-hidden className="text-[var(--m-muted)]" />{email}</span></Row>
        </dl>
      </section>
    </div>
  );
}

export function AcademicSection({ college, branch, graduatingYear, yearLabel, entries }: { college: string | null; branch: string | null; graduatingYear: number | null; yearLabel: string | null; entries: EducationEntry[] }) {
  return (
    <section className={CARD} aria-labelledby="acad-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="acad-h" className={H2}>Academic information</h2>
        <Link href="/dashboard/vault" className={LINK}>Edit education history</Link>
      </div>
      <dl className="mt-1 divide-y divide-[var(--m-rule)]!">
        <Row label="College">{college ?? <Unset />}</Row>
        <Row label="Branch">{branch ?? <Unset />}</Row>
        <Row label="Current year">{yearLabel ?? <Unset />}</Row>
        <Row label="Graduating year">{graduatingYear ?? <Unset />}</Row>
      </dl>
      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--m-rule)]! border-t border-[var(--m-rule)]!">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{e.institutionName}</p>
                <p className={`${MUTED} text-[13px]`}>{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || [e.branch, e.year].filter(Boolean).join(" · ") || "Programme not set"}</p>
              </div>
              <div className="flex items-center gap-3 font-lp-body text-[13px] text-[var(--m-muted)]">
                {e.startYear != null && e.endYear != null && <span>{e.startYear}–{e.endYear}</span>}
                {e.hasVerifiedCertificate && <span className="inline-flex items-center gap-1 font-bold text-[var(--m-accent-ink)]"><BadgeCheck size={14} aria-hidden />Verified</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 && <p className={`mt-3 ${MUTED}`}>No institution on record yet. Add one in your education history.</p>}
    </section>
  );
}

export function SettingsSection({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-5">
      <section className={CARD} aria-labelledby="pw-h">
        <h2 id="pw-h" className={H2}>Change password</h2>
        <p className={`mt-1 mb-4 ${MUTED} text-[13.5px]`}>Enter your current password, then choose a new one. You stay signed in on this device.</p>
        <ChangePasswordForm email={email} />
      </section>
      <section className={CARD} aria-labelledby="acct-h">
        <h2 id="acct-h" className={H2}>Account</h2>
        <dl className="mt-1 divide-y divide-[var(--m-rule)]!">
          <Row label="Email">{email}</Row>
          <Row label="Session"><SignOutButton /></Row>
        </dl>
        <Link href="/settings" className={`${LINK} mt-3 inline-flex items-center gap-1`}>More settings <ArrowRight size={13} aria-hidden /></Link>
      </section>
    </div>
  );
}

/** The right rail: how complete the profile is (what is missing, one click each) and where the skill numbers live. */
export function StrengthCard({ completeness }: { completeness: Completeness }) {
  const { percent, missing } = completeness;
  return (
    <aside className="flex flex-col gap-5" aria-label="Profile strength">
      <section className={CARD}>
        <div className="flex items-baseline justify-between">
          <h2 className={H2}>Profile strength</h2>
          <span className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{percent}%</span>
        </div>
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness" className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--m-ground)]">
          <div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${percent}%` }} />
        </div>
        {missing.length === 0 ? (
          <p className={`mt-3 ${MUTED}`}>Your profile is complete.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {missing.slice(0, 4).map((m) => (
              <li key={m.key} className="font-lp-body text-[13.5px] text-[var(--m-ink)]">{m.label}</li>
            ))}
            {missing.length > 4 && <li className="font-lp-body text-[12.5px] text-[var(--m-muted)]">and {missing.length - 4} more</li>}
          </ul>
        )}
      </section>
      <section className={CARD}>
        <h2 className={H2}>Looking for your skills?</h2>
        <p className={`mt-1.5 ${MUTED} text-[13.5px]`}>Your skills, ELO and readiness live on the dashboard, so this page stays about you.</p>
        <Link href="/dashboard" className={`${LINK} mt-3 inline-flex items-center gap-1`}>Open dashboard overview <ArrowRight size={13} aria-hidden /></Link>
      </section>
    </aside>
  );
}
