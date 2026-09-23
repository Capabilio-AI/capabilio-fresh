import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AssessmentRunner } from "@/components/assessment/AssessmentRunner";

export const metadata: Metadata = {
  title: "Assessment — Capabilio AI",
  description: "Complete your capability assessment.",
};

export default async function AssessmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AssessmentRunner />;
}
