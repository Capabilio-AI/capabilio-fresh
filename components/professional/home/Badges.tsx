import { BadgeCheck, HeartHandshake, ShieldCheck } from "lucide-react";

/** Recognition the platform gives, never something a person claims: EPFO-verified employment and approved mentoring. */
export function Badges({ epfoVerified, mentorApproved }: { epfoVerified: boolean; mentorApproved: boolean }) {
  const items = [
    epfoVerified && { icon: ShieldCheck, label: "EPFO verified", note: "Employment confirmed against EPFO records" },
    mentorApproved && { icon: HeartHandshake, label: "Capabilio mentor", note: "Reviewed and approved to mentor" },
  ].filter(Boolean) as { icon: typeof BadgeCheck; label: string; note: string }[];
  if (items.length === 0) return null;
  return (
    <ul aria-label="Badges" className="flex flex-wrap gap-2">
      {items.map(({ icon: Icon, label, note }) => <li key={label} title={note} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-accent-soft)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--m-accent-ink)]"><Icon size={14} aria-hidden />{label}</li>)}
    </ul>
  );
}
