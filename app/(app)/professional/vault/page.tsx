import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { listDocs } from "@/lib/professional/workspace-server";
import { ProTabs } from "@/components/professional/home/ProTabs";
import { Vault } from "@/components/professional/vault/Vault";

export const metadata: Metadata = { title: "Vault — Capabilio AI" };

/** The professional's documents: resume, certifications and letters, stored privately. */
export default async function ProfessionalVault() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const docs = await listDocs(user.id).catch((e: Error) => {
    console.error("[professional/vault] load failed:", e.message);
    return null;
  });
  return (
    <div className="flex flex-col gap-5">
      <ProTabs />
      {docs ? <Vault docs={docs} /> : <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-ink)]">Your vault could not load right now. Please try again in a moment.</p>}
    </div>
  );
}
