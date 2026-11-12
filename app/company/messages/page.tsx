import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { ThreadsView } from "@/components/org/ThreadsView";

export const metadata: Metadata = { title: "Messages — Company — Capabilio AI" };

export default async function CompanyMessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string; with?: string }> }) {
  const { ctx, service } = await orgPageContext();
  const q = await searchParams;
  return <ThreadsView ctx={ctx} service={service} base="/company/messages" thread={q.thread} withId={q.with} subtitle="Conversations with the colleges that invited you to visit." />;
}
