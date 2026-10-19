import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { OrgContext } from "@/lib/org/context";
import { notify } from "./notify";
import { activeStudents } from "./audiences";

/** A college post went live: tell its students, and everyone who follows the college (never the author). Once per person per post. */
export async function notifyPostPublished(
  service: SupabaseClient<Database>,
  ctx: Pick<OrgContext, "userId" | "institutionId" | "institutionName" | "institutionSlug">,
  post: { id: string; type: string; title: string; is_public: boolean }
): Promise<void> {
  const [students, followersRes] = await Promise.all([
    activeStudents(service, ctx.institutionId),
    untyped(service).from("org_follows").select("user_id").eq("institution_id", ctx.institutionId).limit(5000),
  ]);
  const followers = ((followersRes.data ?? []) as { user_id: string }[]).map((f) => f.user_id);
  const kind = post.type === "event" ? "event" : "announcement";
  await notify(service, {
    userIds: [...students, ...(post.is_public ? followers : [])],
    type: `post_${kind}`,
    title: `${ctx.institutionName}: new ${kind}`,
    body: post.title,
    href: `/o/${ctx.institutionSlug}/posts/${post.id}`,
    actorId: ctx.userId,
    institutionId: ctx.institutionId,
    dedupeKey: `post:${post.id}`,
  });
}

/** Someone reacted to a college post (liked it, RSVPed): tell the staff member who wrote it. */
export async function notifyPostAuthor(
  service: SupabaseClient<Database>,
  p: { postId: string; authorMembershipId: string | null; institutionId: string; institutionSlug: string; actorId: string; type: "post_like" | "post_rsvp"; verb: string }
): Promise<void> {
  if (!p.authorMembershipId) return;
  const db = untyped(service);
  const [{ data: author }, { data: actor }] = await Promise.all([
    db.from("institution_memberships").select("user_id").eq("id", p.authorMembershipId).maybeSingle(),
    service.from("profiles").select("full_name").eq("id", p.actorId).maybeSingle(),
  ]);
  if (!author) return;
  await notify(service, {
    userIds: [(author as { user_id: string }).user_id],
    type: p.type,
    title: `${actor?.full_name ?? "Someone"} ${p.verb}`,
    href: `/o/${p.institutionSlug}/posts/${p.postId}`,
    actorId: p.actorId,
    institutionId: p.institutionId,
    dedupeKey: `${p.type}:${p.postId}:${p.actorId}`,
  });
}

/** Someone liked or commented on a Pulse post: tell its author (never themselves). */
export async function notifyPulsePostAuthor(
  service: SupabaseClient<Database>,
  p: { postId: string; actorId: string; kind: "like" | "comment"; commentId?: string; snippet?: string }
): Promise<void> {
  const [{ data: post }, { data: actor }] = await Promise.all([
    service.from("posts").select("user_id").eq("id", p.postId).maybeSingle(),
    service.from("profiles").select("full_name").eq("id", p.actorId).maybeSingle(),
  ]);
  if (!post) return;
  const name = actor?.full_name ?? "Someone";
  await notify(service, {
    userIds: [post.user_id],
    type: `pulse_${p.kind}`,
    title: p.kind === "like" ? `${name} liked your post` : `${name} commented on your post`,
    body: p.snippet?.slice(0, 140),
    href: "/pulse",
    actorId: p.actorId,
    dedupeKey: p.kind === "like" ? `pulse-like:${p.postId}:${p.actorId}` : `pulse-comment:${p.commentId}`,
  });
}
