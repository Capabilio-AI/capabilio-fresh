import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";

export type AlertKind = "mentor_request" | "mentor_cancelled" | "system";

/** Puts an alert in a working professional's inbox. Never throws: a missing alert must not undo the booking that caused it. */
export async function notify(userId: string, kind: AlertKind, title: string, body: string | null, link: string | null): Promise<void> {
  try {
    const { error } = await untyped(createServiceClient()).from("pro_notifications").insert({ user_id: userId, kind, title: title.slice(0, 120), body: body?.slice(0, 300) ?? null, link });
    if (error) console.error("[mentorship] could not save an alert:", error.message);
  } catch (e) {
    console.error("[mentorship] could not save an alert:", (e as Error).message);
  }
}
