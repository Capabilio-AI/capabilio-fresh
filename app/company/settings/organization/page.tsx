import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { ROLE_LABEL } from "@/lib/org/nav";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { CopyButton } from "@/components/org/CopyButton";
import { initialsOf } from "@/lib/org/format";

export const metadata: Metadata = { title: "Company profile — Settings — Capabilio AI" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--m-rule)]! py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-6">
      <dt className="w-40 shrink-0 text-[13px] font-bold text-[var(--m-muted)]">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-[14px] text-[var(--m-ink)]">{children}</dd>
    </div>
  );
}

export default async function CompanyProfileSettingsPage() {
  const { ctx } = await orgPageContext();
  const publicPath = `/c/${ctx.institutionSlug}`;
  return (
    <div className="flex flex-col gap-5">
      <SettingsCard id="org-h" title="Company profile" description="How your company is recorded on Capabilio.">
        <div className="mb-2 flex items-center gap-3">
          <span aria-hidden className="o-logo-tile flex h-12 w-12 items-center justify-center rounded-full text-[15px]">{initialsOf(ctx.institutionName)}</span>
          <p className="text-[17px] font-extrabold text-[var(--m-ink)]">{ctx.institutionName}</p>
        </div>
        <dl>
          <Fact label="Type">Company</Fact>
          <Fact label="Your role">{ROLE_LABEL[ctx.role] ?? ctx.role}</Fact>
          <Fact label="Public page">
            <Link href={publicPath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-[var(--m-accent-ink)] hover:underline">
              {publicPath} <ExternalLink size={13} aria-hidden />
            </Link>
          </Fact>
          <Fact label="Company ID">
            <span className="inline-flex flex-wrap items-center gap-3">
              <code className="rounded bg-[var(--m-ground)] px-2 py-1 font-mono text-[12.5px]">{ctx.institutionId}</code>
              <CopyButton text={ctx.institutionId} label="Copy ID" />
            </span>
          </Fact>
        </dl>
      </SettingsCard>
      <SettingsCard id="edit-h" title="Logo, cover and details" description="These live on your company page editor, where you can preview what visitors see.">
        <Link href="/company/profile" className="o-btn">Edit company page</Link>
      </SettingsCard>
    </div>
  );
}
