import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary, initialsOf } from "@/lib/dashboard/viewer";
import { getEducationEntries } from "@/lib/dashboard/education";
import { formatAcademicYear } from "@/lib/career/academic-year";
import { getCareerIntent } from "@/lib/careers/intent";
import { createServiceClient } from "@/lib/supabase/service";
import { profileCompleteness } from "@/lib/profile/details";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileTabs, tabOf } from "@/components/profile/ProfileTabs";
import { AboutSection, AcademicSection, SettingsSection, StrengthCard } from "@/components/profile/ProfileSections";
import { PassportSection } from "@/components/profile/PassportSection";
import { loadPassportSkills } from "@/lib/passport/data";
import { loadReel } from "@/lib/passport/reel-data";
import { passportQrSvg } from "@/lib/passport/qr";
import { passportUrl } from "@/lib/passport/url";
import type { Db } from "@/lib/assess/db";
import type { EditableProfile } from "@/components/profile/EditProfileDialog";

export const metadata: Metadata = { title: "Profile — Capabilio AI" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ supabase, user }, { tab: rawTab }] = await Promise.all([requireAuthedUser(), searchParams]);
  const tab = tabOf(rawTab);

  const service = createServiceClient();
  const [viewer, { data: details }, educationEntries, { intent }, passport] = await Promise.all([
    getViewerSummary(supabase, user.id),
    supabase.from("profiles").select("cover_url, headline, bio, location, phone, portfolio_show_contact, passport_code, passport_public").eq("id", user.id).single(),
    getEducationEntries(supabase, user.id),
    getCareerIntent(service, user.id),
    loadPassportSkills(service as unknown as Db, user.id),
  ]);

  const graduatingYear = viewer.direction?.endYear ?? null;
  const yearLabel = formatAcademicYear(viewer.direction?.academicYear?.year ?? null, viewer.direction?.startYear ?? null, viewer.direction?.endYear ?? null);
  const aspiringFor = intent.primary?.name ?? null;
  const passportCode = details?.passport_code ?? "";
  const shared = details?.passport_public ?? false;

  const profile: EditableProfile = {
    fullName: viewer.fullName ?? "",
    headline: details?.headline ?? null,
    bio: details?.bio ?? null,
    location: details?.location ?? null,
    phone: details?.phone ?? null,
    showContact: details?.portfolio_show_contact ?? false,
  };
  const completeness = profileCompleteness({
    avatarUrl: viewer.avatarUrl, coverUrl: details?.cover_url ?? null, headline: profile.headline, bio: profile.bio, aspiringFor,
    college: viewer.collegeName, branch: viewer.branch, graduatingYear,
    hasBadge: passport.skills.some((x) => x.badge), passportShared: shared,
  });

  const reel = tab === "passport" ? await loadReel(service, user.id) : null;

  return (
    <div className="flex flex-col gap-5">
      <ProfileHero
        profile={{ ...profile, fullName: profile.fullName || "Student" }}
        avatarUrl={viewer.avatarUrl} coverUrl={details?.cover_url ?? null} initials={initialsOf(viewer.fullName, viewer.email)}
        aspiringFor={aspiringFor} college={viewer.collegeName} branch={viewer.branch} graduatingYear={graduatingYear}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ProfileTabs active={tab} />
          {tab === "about" && <AboutSection profile={profile} aspiringFor={aspiringFor} location={profile.location} email={viewer.email} />}
          {tab === "academic" && <AcademicSection college={viewer.collegeName} branch={viewer.branch} graduatingYear={graduatingYear} yearLabel={yearLabel} entries={educationEntries} />}
          {tab === "passport" && reel && (
            <PassportSection
              holderName={profile.fullName || "Student"} college={viewer.collegeName} passportNo={reel.input.holder.passportNo}
              qrSvg={await passportQrSvg(await passportUrl(passportCode))} url={await passportUrl(passportCode)} shared={shared}
              unlocked={passport.unlocked} roleName={passport.roleName} skills={passport.skills} reel={reel.input}
            />
          )}
          {tab === "settings" && <SettingsSection email={viewer.email} />}
        </div>
        <StrengthCard completeness={completeness} />
      </div>
    </div>
  );
}
