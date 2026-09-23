import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PulseFeed } from "@/components/pulse/PulseFeed";

export const metadata: Metadata = {
  title: "Pulse — Capabilio AI",
  description: "See what your peers are sharing.",
};

export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-lp-surface px-4 py-10">
      <PulseFeed />
    </main>
  );
}
