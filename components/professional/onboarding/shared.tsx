import clsx from "clsx";
import { TIER_LABEL, isVerifiedTier } from "@/lib/professional/tiers";
import type { VerificationTier } from "@/lib/professional/types";

/** A quiet text link with an arrow, for rows in ruled lists. */
export const LINK = "inline-flex items-center gap-1 rounded text-[13.5px] font-bold text-[var(--m-accent-ink)] underline-offset-4 hover:underline focus-visible:outline-2";
export const ICON_BTN = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--m-muted)] transition-colors hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)]";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtMonth = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const fmtRange = (start: string, end: string | null) => `${fmtMonth(start)} to ${end ? fmtMonth(end) : "present"}`;
export const fmtTenure = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} ${y === 1 ? "year" : "years"}` : "", m || !y ? `${m} ${m === 1 ? "month" : "months"}` : ""].filter(Boolean).join(" ");
};

/** Verified checks are filled with the accent; anything else is outlined and dashed, like the track. */
export function TierPill({ tier }: { tier: VerificationTier }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold", isVerifiedTier(tier) ? "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]" : "border border-dashed border-[var(--m-off)] text-[var(--m-muted)]")}>{TIER_LABEL[tier]}</span>
  );
}
