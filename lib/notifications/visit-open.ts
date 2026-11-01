import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { notify } from "./notify";
import { activeStudents, launchpadOpenAmong } from "./audiences";

/** Pure. What a student is told when a company visit opens: how to register if they can, otherwise when it will apply to them. */
export function visitOpenCopy(company: string, role: string, deadline: string | null, canRegister: boolean): { title: string; body: string } {
  return canRegister
    ? { title: `${company} is visiting your college`, body: `${role}${deadline ? ` · register by ${deadline}` : ""}. Register in Launchpad.` }
    : { title: `${company} is visiting your college`, body: `${role}. Company visits are open to final-year students: you will be able to register when you reach your final year.` };
}

export interface OpenedVisit {
  id: string;
  company: string;
  role: string;
  deadline: string | null;
  eligible_branches: string[] | null;
}

/**
 * Tells every eligible student of the college that a visit is open for registration. Students who can register get the register message with a
 * Launchpad link; the others (earlier years) get a short heads-up instead of a link to a screen that is locked for them. Once per student per visit.
 */
export async function notifyVisitOpened(service: SupabaseClient<Database>, institutionId: string, visit: OpenedVisit, actorId: string): Promise<void> {
  const everyone = await activeStudents(service, institutionId, visit.eligible_branches);
  const open = await launchpadOpenAmong(service, everyone);
  const base = { type: "drive_open", actorId, institutionId, dedupeKey: `drive-open:${visit.id}` };
  await notify(service, { ...base, ...visitOpenCopy(visit.company, visit.role, visit.deadline, true), userIds: everyone.filter((id) => open.has(id)), href: "/launchpad" });
  await notify(service, { ...base, ...visitOpenCopy(visit.company, visit.role, visit.deadline, false), userIds: everyone.filter((id) => !open.has(id)), href: "/dashboard" });
}
