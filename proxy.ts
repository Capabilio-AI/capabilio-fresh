import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /api/* is excluded: every route handler already calls
  // supabase.auth.getUser() itself via requireUser() (a real network round
  // trip to Auth — getUser() always re-verifies server-side, unlike
  // getSession()), so middleware doing the same check first was a second,
  // fully redundant auth round trip on every single API request.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|logo-mark.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
