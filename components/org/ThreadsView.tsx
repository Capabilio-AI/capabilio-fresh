import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import type { OrgContext } from "@/lib/org/context";
import { loadThreadMessages, listThreads, markThreadRead, ownThread, getOrCreateThread } from "@/lib/org/threads";
import { listApprovedCompanies } from "@/lib/org/requests";
import { untyped } from "@/lib/org/db";
import { ThreadPanel } from "@/components/org/ThreadPanel";
import { PageHeader } from "@/components/org/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Whether this organisation may open a conversation with `otherId`: a college with any approved company, a company only with a college that invited it. */
async function mayStart(service: SupabaseClient<Database>, ctx: OrgContext, otherId: string): Promise<boolean> {
  if (ctx.kind === "company") {
    const { data } = await untyped(service).from("campus_visit_requests").select("id").eq("company_id", ctx.institutionId).eq("college_id", otherId).order("id").limit(1);
    return Boolean(data?.length);
  }
  return (await listApprovedCompanies(service)).some((c) => c.id === otherId);
}

/** The shared Messages screen. `base` is the path it lives at, so the same view serves /company/messages and /org/companies/messages. */
export async function ThreadsView({ ctx, service, base, thread: wantedId, withId, subtitle }: { ctx: OrgContext; service: SupabaseClient<Database>; base: string; thread?: string; withId?: string; subtitle: string }) {
  let openId = wantedId;
  if (withId && /^[0-9a-f-]{36}$/i.test(withId) && (await mayStart(service, ctx, withId))) openId = await getOrCreateThread(service, ctx, withId);
  const threads = await listThreads(service, ctx);
  const current = threads.find((t) => t.id === openId) ?? threads[0];
  const owned = current ? await ownThread(service, ctx, current.id) : null;
  const messages = owned ? await loadThreadMessages(service, ctx, owned.id) : [];
  if (owned) await markThreadRead(service, ctx.userId, owned.id);

  return (
    <div>
      <PageHeader title="Messages" subtitle={subtitle} />
      {threads.length === 0 ? (
        <div className="o-card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <MessagesSquare size={28} aria-hidden className="text-[var(--m-off)]" />
          <p className="text-[15px] font-bold text-[var(--m-ink)]">No conversations yet</p>
          <p className="max-w-md text-[13.5px] text-[var(--m-muted)]">{ctx.kind === "company" ? "When a college invites you to visit and you accept, your conversation with them opens here." : "Open a company on the Companies page and choose Message to start a conversation."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[250px_1fr]">
          <aside aria-label="Conversations">
            <ul className="flex flex-col gap-1">
              {threads.map((t) => {
                const active = t.id === current?.id;
                return (
                  <li key={t.id}>
                    <Link href={`${base}?thread=${t.id}`} aria-current={active ? "page" : undefined} className={`block rounded-xl px-3 py-2.5 transition-colors ${active ? "ws-thumb" : "hover:bg-[var(--m-accent-soft)]"}`}>
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[var(--m-ink)]">{t.otherName}</span>
                        {t.unread > 0 && !active && (
                          <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-black text-[var(--o-ink-on-gold)]" style={{ background: "var(--o-gradient)" }} aria-label={`${t.unread} unread`}>{t.unread}</span>
                        )}
                      </span>
                      {t.lastBody && <span className="mt-0.5 block truncate text-[12px] text-[var(--m-muted)]">{t.lastBody}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
          <section className="o-card p-4" aria-label={current ? `Conversation with ${current.otherName}` : "Conversation"}>
            {current && owned && (
              <>
                <header className="mb-3 border-b border-[var(--m-rule)]! pb-3">
                  <h2 className="text-[15px] font-extrabold text-[var(--m-ink)]">{current.otherName}</h2>
                </header>
                <ThreadPanel key={current.id} threadId={current.id} otherName={current.otherName} initial={messages} />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
