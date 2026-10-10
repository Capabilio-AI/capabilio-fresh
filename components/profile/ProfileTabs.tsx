import { SegmentedLinks } from "@/components/dashboard/SegmentedLinks";

export const TABS = [
  { id: "about", label: "About" },
  { id: "academic", label: "Academic" },
  { id: "passport", label: "Skill passport" },
  { id: "settings", label: "Settings" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

export const tabOf = (raw: string | string[] | undefined): TabId => TABS.find((t) => t.id === raw)?.id ?? "about";

export function ProfileTabs({ active }: { active: TabId }) {
  return <SegmentedLinks label="Profile sections" segments={TABS.map((t) => ({ label: t.label, href: `/profile?tab=${t.id}`, active: t.id === active }))} />;
}
