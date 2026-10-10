import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generatePassportNumber } from "./number";

const MAX_ATTEMPTS = 8;
const UNIQUE_VIOLATION = "23505";

/** The student's passport number; issued on first use. The unique index decides collisions, so a clash just draws another number. */
export async function ensurePassportNumber(service: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data } = await service.from("profiles").select("passport_no").eq("id", userId).single();
  if (data?.passport_no) return data.passport_no;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generatePassportNumber();
    // "is null" keeps a concurrent request from overwriting a number that was issued a moment ago
    const { data: updated, error } = await service.from("profiles").update({ passport_no: candidate }).eq("id", userId).is("passport_no", null).select("passport_no");
    if (!error && updated && updated.length > 0) return candidate;
    if (!error) {
      const { data: again } = await service.from("profiles").select("passport_no").eq("id", userId).single();
      if (again?.passport_no) return again.passport_no;
    } else if (error.code !== UNIQUE_VIOLATION) {
      throw error;
    }
  }
  throw new Error("Could not issue a unique passport number");
}
