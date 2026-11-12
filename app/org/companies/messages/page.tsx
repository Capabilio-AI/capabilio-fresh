import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { ThreadsView } from "@/components/org/ThreadsView";
import { companyTabs } from "@/lib/org/section-tabs";
import { SectionTabs } from "@/components/org/SectionTabs";

export const metadata: Metadata = { title: "Company messages — Capabilio AI" };

export default async function CollegeCompanyMessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string; with?: string }> }) {
  const { ctx, service } = await orgPageContext("postPlacement");
  const q = await searchParams;
  return (
    <div>
      <SectionTabs label="Company sections" active="/org/companies/messages" tabs={companyTabs()} />
      <ThreadsView ctx={ctx} service={service} base="/org/companies/messages" thread={q.thread} withId={q.with} subtitle="Conversations with companies you have invited or contacted." />
    </div>
  );
}
