import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";

const BodySchema = z.object({
  language: z.string(),
  code: z.string().min(1).max(10_000),
  stdin: z.string().max(2_000).optional().default(""),
});

/** Explore/iterate only — no grading, no question lookup. Used by the "Run" button while editing. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!isSupportedLanguage(parsed.data.language)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  try {
    const result = await runCode(parsed.data.language, parsed.data.code, parsed.data.stdin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Code execution service is unavailable — try again." }, { status: 502 });
  }
}
