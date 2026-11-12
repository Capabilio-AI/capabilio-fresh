import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "./db";

export const REQUEST_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "neutral" | "info" }> = {
  pending: { label: "Waiting for reply", tone: "info" },
  accepted: { label: "Accepted", tone: "ok" },
  declined: { label: "Declined", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** A college invites a company. The ids that matter (college, sender) come from the session, never from here. */
export const NewRequestSchema = z
  .object({
    companyId: z.string().uuid(),
    role: z.string().trim().min(2, "Name the role you want them to hire for.").max(120),
    proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").optional().or(z.literal("").transform(() => undefined)),
    location: z.string().trim().max(160).optional(),
    message: z.string().trim().min(1, "Write a short note to the company.").max(1000),
  })
  .strict();

export const RespondSchema = z.object({ id: z.string().uuid(), decision: z.enum(["accept", "decline"]), note: z.string().trim().max(500).optional() }).strict();
export const CancelSchema = z.object({ id: z.string().uuid() }).strict();

export interface VisitRequest {
  id: string;
  collegeId: string;
  companyId: string;
  /** the other side's name, from the viewer's point of view */
  otherName: string;
  role: string;
  proposedDate: string | null;
  location: string | null;
  message: string;
  status: string;
  responseNote: string | null;
  createdAt: string;
  respondedAt: string | null;
}

interface Row {
  id: string;
  college_id: string;
  company_id: string;
  role: string;
  proposed_date: string | null;
  location: string | null;
  message: string;
  status: string;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
}
const COLUMNS = "id, college_id, company_id, role, proposed_date, location, message, status, response_note, created_at, responded_at";

/** Pure. A request can still be answered only while it is waiting. */
export const isOpen = (status: string): boolean => status === "pending";

export async function listRequests(service: SupabaseClient<Database>, side: "college" | "company", institutionId: string): Promise<VisitRequest[]> {
  const db = untyped(service);
  const mine = side === "college" ? "college_id" : "company_id";
  const { data, error } = await db.from("campus_visit_requests").select(COLUMNS).eq(mine, institutionId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Requests load failed: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const otherIds = [...new Set(rows.map((r) => (side === "college" ? r.company_id : r.college_id)))];
  const { data: names } = otherIds.length ? await service.from("institutions").select("id, name").in("id", otherIds) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.name]));
  return rows.map((r) => ({
    id: r.id,
    collegeId: r.college_id,
    companyId: r.company_id,
    otherName: nameOf.get(side === "college" ? r.company_id : r.college_id) ?? "Unknown",
    role: r.role,
    proposedDate: r.proposed_date,
    location: r.location,
    message: r.message,
    status: r.status,
    responseNote: r.response_note,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
  }));
}

export interface CompanyListing {
  id: string;
  name: string;
  slug: string;
  city: string | null;
}

/** Companies Capabilio has approved: an institution of type company with an active company admin. */
export async function listApprovedCompanies(service: SupabaseClient<Database>): Promise<CompanyListing[]> {
  const db = untyped(service);
  const { data: admins } = await db.from("institution_memberships").select("institution_id").eq("role", "company_admin").eq("status", "active");
  const ids = [...new Set(((admins ?? []) as { institution_id: string }[]).map((a) => a.institution_id))];
  if (ids.length === 0) return [];
  const { data } = await service.from("institutions").select("id, name, slug, city").in("id", ids).order("name");
  return (data ?? []) as CompanyListing[];
}
