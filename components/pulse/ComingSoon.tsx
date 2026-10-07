import { GraduationCap, Users } from "lucide-react";

const COPY = {
  communities: { icon: Users, title: "Communities are on the way", body: "Branch, college and skill communities: join the people on your track, ask questions and share resources. We're finishing this next." },
  mentors: { icon: GraduationCap, title: "Mentors are on the way", body: "Verified mentors with their expertise and availability. Follow them, read their posts and request a conversation. Mentor applications open with this release." },
} as const;

export function ComingSoon({ tab }: { tab: keyof typeof COPY }) {
  const { icon: Icon, title, body } = COPY[tab];
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-app-border bg-white px-8 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-orange-container text-app-orange"><Icon size={20} aria-hidden="true" /></span>
      <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">{title}</h2>
      <p className="max-w-md font-lp-body text-[13px] leading-relaxed text-app-muted">{body}</p>
    </div>
  );
}
