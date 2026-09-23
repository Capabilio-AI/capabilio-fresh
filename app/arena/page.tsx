import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ArenaView } from "@/components/arena/ArenaView";

export const metadata: Metadata = {
  title: "Arena — Capabilio AI",
  description: "Timed challenges and the ELO leaderboard.",
};

export default async function ArenaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-lp-surface px-4 py-10">
      <ArenaView />
    </main>
  );
}
