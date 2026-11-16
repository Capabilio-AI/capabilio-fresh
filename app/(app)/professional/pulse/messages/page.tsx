import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { blockedWith } from "@/lib/pulse/graph";
import { conversationWith } from "@/lib/pulse/messages";
import { loadPeople } from "@/lib/pulse/people";
import { MessagesApp } from "@/components/messages/MessagesApp";

export const metadata: Metadata = { title: "Messages — Pulse — Capabilio AI" };
const UUID = /^[0-9a-f-]{36}$/i;
const BASE = "/professional/pulse/messages";

/** A working professional's inbox: the same conversations students and graduates write into, so a mentor reads what a student sent. */
export default async function ProfessionalMessages({ searchParams }: { searchParams: Promise<{ c?: string; to?: string }> }) {
  await requireStage(["professional"]);
  const { c, to } = await searchParams;
  const { user } = await requireAuthedUser();
  const service = createServiceClient();

  let startWith = null;
  if (to && UUID.test(to) && to !== user.id) {
    const existing = await conversationWith(service, user.id, to);
    if (existing) redirect(`${BASE}?c=${existing}`);
    const [people, blocked] = await Promise.all([loadPeople(service, [to]), blockedWith(service, user.id)]);
    startWith = !blocked.has(to) ? (people.get(to) ?? null) : null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/professional/pulse" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden="true" /> Pulse</Link>
        <h1 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Messages</h1>
      </div>
      <MessagesApp me={user.id} initialId={c && UUID.test(c) ? c : null} startWith={startWith} base={BASE} />
    </div>
  );
}
