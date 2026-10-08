import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCommunityBySlug } from "@/lib/pulse/communities";
import { canModerate } from "@/lib/pulse/community-rules";
import { loadPeople } from "@/lib/pulse/people";
import { CommunityHeader } from "@/components/pulse/CommunityHeader";
import { PulseFeed } from "@/components/pulse/PulseFeed";

export const metadata: Metadata = { title: "Community — Pulse — Capabilio AI" };

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const found = await getCommunityBySlug(service, user.id, slug);
  if (!found) notFound();
  const me = (await loadPeople(service, [user.id])).get(user.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/pulse?tab=communities" className="inline-flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted hover:text-[var(--m-ink)]"><ArrowLeft size={13} aria-hidden="true" /> Communities</Link>
      <CommunityHeader community={found.summary} />
      <PulseFeed
        key={`${slug}-${found.access.member}`}
        view={{ mode: "community", slug, canPost: found.access.member, canModerate: canModerate(found.access.role) }}
        viewer={{ id: user.id, name: me?.name ?? null, avatarUrl: me?.avatarUrl ?? null }}
      />
    </div>
  );
}
