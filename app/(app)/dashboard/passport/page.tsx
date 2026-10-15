import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { loadPassportSkills } from "@/lib/passport/data";
import { loadReel } from "@/lib/passport/reel-data";
import { passportQrSvg } from "@/lib/passport/qr";
import { passportUrl } from "@/lib/passport/url";
import type { Db } from "@/lib/assess/db";
import { PageHead } from "@/components/dashboard/PageHead";
import { PassportSection } from "@/components/profile/PassportSection";

export const metadata: Metadata = { title: "Skill Passport — Capabilio AI" };

/** The Skill Passport on the dashboard: verified badges, a QR and public link, and the proof reel. Same for every stage. */
export default async function DashboardPassportPage() {
  const { supabase, user } = await requireAuthedUser();
  const service = createServiceClient();
  const [viewer, { data: details }, passport, reel] = await Promise.all([
    getViewerSummary(supabase, user.id),
    supabase.from("profiles").select("passport_code, passport_public").eq("id", user.id).single(),
    loadPassportSkills(service as unknown as Db, user.id),
    loadReel(service, user.id),
  ]);
  const url = await passportUrl(details?.passport_code ?? "");

  return (
    <div>
      <PageHead title="Skill Passport" intro="Your verified skills in one place you can share: badges earned from real assessments, a QR code and a public link for recruiters." />
      <div className="pt-4">
        <PassportSection
          holderName={viewer.fullName || "Your name"} college={viewer.collegeName} passportNo={reel.input.holder.passportNo}
          qrSvg={await passportQrSvg(url)} url={url} shared={details?.passport_public ?? false}
          unlocked={passport.unlocked} roleName={passport.roleName} skills={passport.skills} reel={reel.input}
        />
      </div>
    </div>
  );
}
