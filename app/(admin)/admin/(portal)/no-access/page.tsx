import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/db";
import { homeFor, ROLE_LABEL, ROLE_SUMMARY } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NoAccess() {
  const admin = await requireAdminPage();
  return (
    <div>
      <PageHeader eyebrow="Not for your role" title="You do not have access to that page" intro={`You are signed in as ${ROLE_LABEL[admin.role]}. ${ROLE_SUMMARY[admin.role]} Ask an owner if you need more.`} />
      <Link href={homeFor(admin)} className="inline-flex rounded-full bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[14px] font-bold text-white">Go to your home page</Link>
    </div>
  );
}
