import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getGroqClient, GROQ_MODEL } from "@/lib/ai/groq";
import { matchCareersForStudent } from "@/lib/career/match";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { getDashboardData, DashboardNotReadyError } from "@/lib/dashboard/data";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";

// Every message is a Groq call — a real cost surface with no prior limit
// (docs/audit/2026-09-27-full-audit.md §5).
const RATE_LIMIT = { bucket: "mentor_chat", maxRequests: 20, windowSeconds: 60 };

const BodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20),
});

const FALLBACK_REPLY =
  "I'm having trouble reaching my reasoning engine right now — try again in a moment. In the meantime, your dashboard's Next Best Action card has my latest recommendation.";

async function buildContextLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const parts: string[] = [];

  try {
    const dashboardData = await getDashboardData(supabase, userId);
    const lowSections = dashboardData.sectionScores
      .filter((s) => s.section !== "career_interests" && s.percentage < 50)
      .map((s) => `${s.label} (${s.percentage}%)`);
    if (lowSections.length > 0) {
      parts.push(`Weaker diagnostic sections: ${lowSections.join(", ")}.`);
    }
  } catch (error) {
    if (!(error instanceof DashboardNotReadyError)) throw error;
    parts.push("The student has not completed the diagnostic assessment yet.");
  }

  const careerMatches = await matchCareersForStudent(supabase, userId);
  const top = careerMatches[0] ?? null;
  if (top) {
    parts.push(`Top career match: ${top.careerRole} at ${top.overallReadiness}% readiness (${top.recommendation}).`);
    const nextAction = computeNextAction(top);
    if (nextAction) {
      parts.push(
        `Biggest skill gap: ${nextAction.skill} (current ${nextAction.currentLevel ?? "unassessed"}, target ${nextAction.targetLevel}).`
      );
    }
  } else {
    parts.push("No career match data available yet.");
  }

  return parts.join(" ");
}

function buildSystemPrompt(contextLine: string): string {
  return `You are Capabilio's AI Mentor for an Indian engineering (B.Tech) student using a career-readiness platform.
Ground every suggestion in the real data given below — never invent scores, career matches, or claim things you don't know.
If the data below doesn't cover what the student asks, say so plainly instead of guessing.
Keep replies concise (2-5 sentences), concrete, and encouraging without being generic. Never promise a job or interview outcome.

Student's current real data: ${contextLine}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, RATE_LIMIT);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const contextLine = await buildContextLine(supabase, auth.userId);
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.5,
      messages: [
        { role: "system", content: buildSystemPrompt(contextLine) },
        ...parsed.data.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: parsed.data.message },
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ reply: reply || FALLBACK_REPLY });
  } catch (error) {
    // Never fail the chat surface — log server-side, hand the client a graceful fallback.
    console.error("[mentor/chat] Groq request failed:", error);
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }
}
