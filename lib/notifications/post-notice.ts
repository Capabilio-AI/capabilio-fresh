/** What a newly published post says to the people who follow the page. Colleges link to their /o page, companies to their /c page. */
export interface PostNotice {
  type: string;
  title: string;
  href: string;
}

const COMPANY_VERB: Record<string, string> = {
  update: "posted an update",
  hiring: "is hiring",
  milestone: "shared a milestone",
  event: "announced an event",
  announcement: "made an announcement",
};

/** Pure. */
export function postNotice(org: { company: boolean; name: string; slug: string }, post: { id: string; type: string; title: string }): PostNotice {
  if (org.company) {
    const verb = COMPANY_VERB[post.type] ?? COMPANY_VERB.update;
    return { type: `post_${post.type in COMPANY_VERB ? post.type : "update"}`, title: `${org.name} ${verb}`, href: `/c/${org.slug}` };
  }
  const kind = post.type === "event" ? "event" : "announcement";
  return { type: `post_${kind}`, title: `${org.name}: new ${kind}`, href: `/o/${org.slug}/posts/${post.id}` };
}
