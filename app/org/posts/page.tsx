import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { untyped, type OrgPostRow, type OrgProfileRow } from "@/lib/org/db";
import { ActionButton } from "@/components/org/ActionButton";
import { JsonForm } from "@/components/org/JsonForm";
import { EmptyState, PageHeader, Panel, Pill, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Posts & page — Capabilio AI" };

export default async function OrgPostsPage() {
  const { ctx, service } = await orgPageContext("publishPost");
  const db = untyped(service);
  let q = db.from("org_posts").select("*").eq("institution_id", ctx.institutionId).order("created_at", { ascending: false }).limit(50);
  if (ctx.kind === "staff") q = q.eq("author_membership_id", ctx.membershipId);
  const posts = ((await q).data ?? []) as OrgPostRow[];
  const profile = ctx.kind === "admin" ? (((await db.from("org_profiles").select("*").eq("institution_id", ctx.institutionId).maybeSingle()).data ?? null) as OrgProfileRow | null) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Posts & public page" subtitle="Events and announcements only — no comments, no open feed. Students can follow, like and share a link." />

      {ctx.kind === "admin" && (
        <Panel title="Public page">
          <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">
            Your page stays private until you switch it on. When public, anyone can see the page and its published events; announcements stay members-only unless you mark them public.
            {profile?.is_public && (
              <>
                {" "}
                <Link href={`/o/${ctx.institutionSlug}`} className="text-app-blue hover:underline">
                  View page
                </Link>
              </>
            )}
          </p>
          <JsonForm
            action="/api/org/profile"
            submitLabel="Save page"
            resetOnSuccess={false}
            fields={[
              { name: "bio", label: "About", type: "textarea", defaultValue: profile?.bio ?? "" },
              { name: "websiteUrl", label: "Website", type: "url", defaultValue: profile?.website_url ?? "" },
              { name: "coverImageUrl", label: "Cover image link", type: "url", defaultValue: profile?.cover_image_url ?? "" },
              { name: "isPublic", label: "Make the page public", type: "checkbox", defaultValue: profile?.is_public ?? false },
            ]}
          />
        </Panel>
      )}

      <Panel title="New post">
        <JsonForm
          action="/api/org/posts"
          submitLabel="Save post"
          successMessage="Saved."
          fields={[
            { name: "type", label: "Type", type: "select", required: true, defaultValue: "announcement", options: [{ value: "announcement", label: "Announcement" }, { value: "event", label: "Event" }] },
            { name: "title", label: "Title", required: true },
            { name: "body", label: "Text", type: "textarea", required: true },
            { name: "eventStartsAt", label: "Event starts (events only)", type: "datetime-local" },
            { name: "eventLocation", label: "Location (events only)" },
            { name: "eventLink", label: "Event link (events only)", type: "url" },
            { name: "coverImageUrl", label: "Cover image link", type: "url" },
            { name: "isPublic", label: "Announcement visible to the public (events are public when the page is)", type: "checkbox" },
            { name: "publish", label: "Publish now (otherwise saved as a draft)", type: "checkbox", defaultValue: true },
          ]}
        />
      </Panel>

      <Panel title={ctx.kind === "staff" ? "Your posts" : "All posts"}>
        {posts.length === 0 ? (
          <EmptyState title="Nothing posted yet" body="Drafts and published posts appear here." />
        ) : (
          <ul className="divide-y divide-app-border">
            {posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{p.title}</p>
                  <p className="font-lp-mono text-[11px] text-app-muted">
                    {p.type}
                    {p.event_starts_at ? ` · ${formatDateTime(p.event_starts_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={p.status === "published" ? "ok" : "neutral"}>{p.status}</Pill>
                  <ActionButton action="/api/org/posts/action" body={{ postId: p.id, action: p.status === "published" ? "unpublish" : "publish" }} label={p.status === "published" ? "Unpublish" : "Publish"} variant="ghost" />
                  <ActionButton action="/api/org/posts/action" body={{ postId: p.id, action: "delete" }} label="Delete" variant="danger" confirm="Delete this post?" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
