import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { DATA_ANALYST, statedRoleMatches } from "@/lib/domain-workstations/roles";
import { loadDomainState } from "@/lib/domain-workstations/state";

async function respond(forceStart: boolean) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const statedRole = await getStatedCareerInterest(supabase, auth.userId);
  const autoStart = forceStart || statedRoleMatches(DATA_ANALYST, statedRole);

  try {
    const state = await loadDomainState(createServiceClient(), auth.userId, DATA_ANALYST, autoStart);
    return NextResponse.json({
      ...state,
      statedRole,
      role: { key: DATA_ANALYST.key, label: DATA_ANALYST.label, company: DATA_ANALYST.company, companyBlurb: DATA_ANALYST.companyBlurb },
      schema: DATA_ANALYST.schema,
    });
  } catch (error) {
    console.error("[arena/domain] could not load the domain ticket:", error);
    return NextResponse.json({ error: "Could not load your ticket — try again." }, { status: 500 });
  }
}

export async function GET() {
  return respond(false);
}

/** Opt in to the Data Analyst workstation when the student's stated career is something else. */
export async function POST() {
  return respond(true);
}
