import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { blockedWith } from "@/lib/pulse/graph";
import { conversationWith } from "@/lib/pulse/messages";
import { loadPeople } from "@/lib/pulse/people";
import { MessagesApp } from "@/components/messages/MessagesApp";

export const metadata: Metadata = { title: "Messages — Pulse — Capabilio AI" };
const UUID = /^[0-9a-f-]{36}$/i;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string; to?: string }> }) {
  const { c, to } = await searchParams;
  const { user } = await requireAuthedUser();
  const service = createServiceClient();

  let startWith = null;
  if (to && UUID.test(to) && to !== user.id) {
    const existing = await conversationWith(service, user.id, to);
    if (existing) redirect(`/pulse/messages?c=${existing}`);
    const [people, blocked] = await Promise.all([loadPeople(service, [to]), blockedWith(service, user.id)]);
    startWith = !blocked.has(to) ? (people.get(to) ?? null) : null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/pulse" className="inline-flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden="true" /> Pulse</Link>
        <h1 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Messages</h1>
      </div>
      <MessagesApp me={user.id} initialId={c && UUID.test(c) ? c : null} startWith={startWith} />
    </div>
  );
}
