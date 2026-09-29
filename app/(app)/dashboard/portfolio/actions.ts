"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { generatePortfolioSlug } from "@/lib/portfolio/share";

export async function getPortfolioShareUrl(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/p/${slug}`;
}

/** Creates the slug on first use (kept stable after that) and turns sharing on. */
export async function enablePortfolioSharing(): Promise<{ url: string } | { error: string }> {
  const { supabase, user } = await requireAuthedUser();

  const { data: existing } = await supabase.from("profiles").select("portfolio_slug").eq("id", user.id).single();
  let slug = existing?.portfolio_slug ?? null;

  if (!slug) {
    slug = generatePortfolioSlug();
    const { error } = await supabase.from("profiles").update({ portfolio_slug: slug, portfolio_public: true }).eq("id", user.id);
    if (error) {
      // Extremely unlikely random-slug collision — one retry is enough.
      slug = generatePortfolioSlug();
      const retry = await supabase.from("profiles").update({ portfolio_slug: slug, portfolio_public: true }).eq("id", user.id);
      if (retry.error) return { error: "Could not create a share link — try again." };
    }
  } else {
    const { error } = await supabase.from("profiles").update({ portfolio_public: true }).eq("id", user.id);
    if (error) return { error: "Could not enable sharing — try again." };
  }

  revalidatePath("/dashboard/portfolio");
  return { url: await getPortfolioShareUrl(slug) };
}

export async function disablePortfolioSharing(): Promise<void> {
  const { supabase, user } = await requireAuthedUser();
  await supabase.from("profiles").update({ portfolio_public: false }).eq("id", user.id);
  revalidatePath("/dashboard/portfolio");
}
