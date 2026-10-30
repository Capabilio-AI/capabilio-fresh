import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { confirmDomainVerification } from "@/lib/org/signup";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/";
  // same-origin paths only ("//host" would be protocol-relative)
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // the address is now proven, so a college's email domain can be trusted for auto-verification
      if (data.user?.email_confirmed_at && !next.startsWith("/reset-password")) await confirmDomainVerification(createServiceClient(), data.user);
      // Password reset needs the session exchangeCodeForSession just created
      // (updateUser requires an active session). Every other confirmation
      // link (signup verification, resent verification) must not leave the
      // visitor signed in — the product requires an explicit login step
      // after verifying, so the session is dropped before redirecting.
      if (!next.startsWith("/reset-password")) {
        await supabase.auth.signOut({ scope: "local" }); // only this browser: following a link must not sign the user out everywhere
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-link-invalid`);
}
