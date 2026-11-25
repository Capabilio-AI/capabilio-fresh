"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getVerifiedUser } from "@/lib/supabase/aal";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { loadPreparationFromText, type PreparationView } from "@/lib/launchpad/prepare-server";

export interface PrepareState {
  error?: string;
  view?: PreparationView;
}

const MIN_TEXT = 40;
const MAX_TEXT = 8000;

/** Builds a preparation plan from a pasted job description. The text is read once and not stored. */
export async function planFromText(_prev: PrepareState, formData: FormData): Promise<PrepareState> {
  const user = await getVerifiedUser(await createClient());
  if (!user) redirect("/login");

  const limited = await checkRateLimit(user.id, { bucket: "arena_prepare", maxRequests: 20, windowSeconds: 600 });
  if (!limited.allowed) return { error: "That is a lot of plans in a short time. Try again in a few minutes." };

  const text = String(formData.get("text") ?? "").trim();
  if (text.length < MIN_TEXT) return { error: "Paste more of the job description so we can find its skills." };
  if (text.length > MAX_TEXT) return { error: `That is too long. Paste up to ${MAX_TEXT.toLocaleString("en-IN")} characters, the requirements section is enough.` };
  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || "This job";

  const view = await loadPreparationFromText(createServiceClient(), user.id, { title, text });
  if (!view) return { error: "We could not find any skill we know in that text. Paste the requirements or skills section of the job." };
  return { view };
}
