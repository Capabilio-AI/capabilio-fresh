import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface VaultItem {
  id: string;
  item_type: string;
  title: string;
  url: string | null;
  description: string | null;
  created_at: string;
  verified: boolean;
  fileUrl: string | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function getVaultItems(supabase: SupabaseClient<Database>, userId: string): Promise<VaultItem[]> {
  const { data, error } = await supabase
    .from("vault_items")
    .select("id, item_type, title, url, description, created_at, verified, file_path")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const filePaths = (data ?? []).map((item) => item.file_path).filter((p): p is string => Boolean(p));
  const signedUrlByPath = new Map<string, string>();
  if (filePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("certificates")
      .createSignedUrls(filePaths, SIGNED_URL_TTL_SECONDS);
    for (const s of signed ?? []) {
      if (s.signedUrl && !s.error) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    }
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    item_type: item.item_type,
    title: item.title,
    url: item.url,
    description: item.description,
    created_at: item.created_at,
    verified: item.verified,
    fileUrl: item.file_path ? (signedUrlByPath.get(item.file_path) ?? null) : null,
  }));
}
