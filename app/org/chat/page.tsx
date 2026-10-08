import type { Metadata } from "next";
import Link from "next/link";
import { Hash, Lock } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { canAccessChannel, listChannels, listChatMembers, loadMessages, markRead } from "@/lib/org/chat";
import { ChatPanel } from "@/components/org/ChatPanel";
import { NewChannelForm } from "@/components/org/NewChannelForm";
import { PageHeader } from "@/components/org/ui";

export const metadata: Metadata = { title: "Team chat — Capabilio AI" };

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const { ctx, service } = await orgPageContext("useChat");
  const channels = await listChannels(service, ctx);
  const wanted = (await searchParams).channel;
  const current = channels.find((c) => c.id === wanted) ?? channels[0];
  const allowed = current ? await canAccessChannel(service, ctx, current.id) : null;
  const [messages, people] = await Promise.all([allowed ? loadMessages(service, allowed.id) : Promise.resolve([]), listChatMembers(service, ctx)]);
  if (allowed) await markRead(service, ctx, allowed.id);

  return (
    <div>
      <PageHeader title="Team chat" subtitle="A private space for your college's staff. Only people you've given chat access can see it — students never can." />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[230px_1fr]">
        <aside aria-label="Channels" className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {channels.map((c) => {
              const active = c.id === current?.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/org/chat?channel=${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? "bg-white/[0.08] text-app-charcoal" : "text-app-muted hover:bg-white/5 hover:text-app-charcoal"}`}
                  >
                    {c.isPrivate ? <Lock size={14} aria-hidden="true" /> : <Hash size={14} aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.unread > 0 && !active && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-black text-[var(--o-ink-on-gold)]" style={{ background: "var(--o-gradient)" }} aria-label={`${c.unread} unread`}>
                        {c.unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <NewChannelForm people={people} />
        </aside>
        <section className="o-card p-4" aria-label={current ? `Conversation in ${current.name}` : "Conversation"}>
          {current && allowed ? (
            <>
              <header className="mb-3 border-b border-app-border pb-3">
                <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-app-charcoal">
                  {current.isPrivate ? <Lock size={15} aria-hidden="true" /> : <Hash size={15} aria-hidden="true" />} {current.name}
                </h2>
                {current.description && <p className="mt-0.5 text-[12px] text-app-muted">{current.description}</p>}
              </header>
              <ChatPanel key={current.id} channelId={current.id} channelName={current.name} initial={messages} myUserId={ctx.userId} />
            </>
          ) : (
            <p className="py-10 text-center text-[13px] text-app-muted">Pick a channel to start talking.</p>
          )}
        </section>
      </div>
    </div>
  );
}
