import type { ReactNode } from "react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAuthedUser();

  const viewer = await getViewerSummary(supabase, user.id);

  return <AppShell viewer={viewer}>{children}</AppShell>;
}
