import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData, getSkills, DashboardNotReadyError } from "@/lib/dashboard/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "Dashboard — Capabilio AI",
  description: "Your assessment results and profile.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const [data, skills, careerMatches] = await Promise.all([
      getDashboardData(supabase, user.id),
      getSkills(supabase, user.id),
      matchCareersForStudent(supabase, user.id),
    ]);
    return <DashboardView data={data} skills={skills} careerMatches={careerMatches} />;
  } catch (error) {
    if (error instanceof DashboardNotReadyError) {
      redirect("/assessment");
    }
    throw error;
  }
}
