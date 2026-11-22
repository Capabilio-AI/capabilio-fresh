import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadChosenPathway, loadPublishedPathway } from "@/lib/pathways/store";
import { PathwayView } from "@/components/pathways/PathwayView";
import { ChooseGoal } from "@/components/pathways/ChooseGoal";

export const metadata: Metadata = { title: "Pathway | Capabilio AI" };

/** Only a published, reviewed pathway is shown to a student; anything else is not found. */
export default async function PathwayPage({ params }: { params: Promise<{ key: string }> }) {
  const { user } = await requireAuthedUser();
  const { key } = await params;
  const service = createServiceClient();
  const pathway = await loadPublishedPathway(service, key);
  if (!pathway) notFound();
  const chosen = await loadChosenPathway(service, user.id);
  return <div className="flex flex-col gap-6 pt-6"><ChooseGoal pathwayKey={pathway.key} chosen={chosen?.key === pathway.key} /><PathwayView pathway={pathway} /></div>;
}
