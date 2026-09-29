import type { Metadata } from "next";
import { AuthLayout } from "@/components/login/AuthLayout";
import { SignupForm, type JoinLinkInfo } from "@/components/login/SignupForm";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";

export const metadata: Metadata = {
  title: "Create your account — Capabilio AI",
  description: "Start building your verified career profile with Capabilio AI.",
};

/** A valid, active college join link fixes the college (and can pre-fill branch and graduation year). */
async function loadJoinLink(code: string | undefined): Promise<JoinLinkInfo | null> {
  if (!code || !/^[a-z0-9]{8,32}$/.test(code)) return null;
  const service = createServiceClient();
  const { data } = await untyped(service).from("org_join_links").select("institution_id, active, branch, end_year").eq("code", code).maybeSingle();
  const link = data as { institution_id: string; active: boolean; branch: string | null; end_year: number | null } | null;
  if (!link?.active) return null;
  const { data: inst } = await service.from("institutions").select("name").eq("id", link.institution_id).maybeSingle();
  return inst ? { code, collegeName: inst.name, branch: link.branch, endYear: link.end_year } : null;
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const join = await loadJoinLink((await searchParams).join);
  return (
    <AuthLayout>
      <SignupForm join={join} />
    </AuthLayout>
  );
}
