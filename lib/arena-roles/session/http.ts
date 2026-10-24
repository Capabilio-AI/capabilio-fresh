import { NextResponse } from "next/server";
import { AttemptError } from "@/lib/arena-workstations/attempts";
import { SessionError } from "./service";

/** Maps session and attempt errors to responses; anything unexpected is logged and returned as a generic 500. */
export function sessionErrorResponse(error: unknown, scope: string) {
  if (error instanceof SessionError) return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status });
  if (error instanceof AttemptError) return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: "Something went wrong — try again." }, { status: 500 });
}
