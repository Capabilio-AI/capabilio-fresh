import { NextResponse } from "next/server";
import { AttemptError } from "./attempts";

/** Maps service errors to responses; anything unexpected is logged and returned as a generic 500. */
export function attemptErrorResponse(error: unknown, scope: string) {
  if (error instanceof AttemptError) return NextResponse.json({ error: error.message, ...error.extra }, { status: error.status });
  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: "Something went wrong — try again." }, { status: 500 });
}
