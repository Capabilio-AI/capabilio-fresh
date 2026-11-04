import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { PROJECT_BUCKET, type ProjectFile } from "./project-files";

const SIGNED_SECONDS = 60 * 60;

/** Short-lived links for private project files, one call for any number of files. A file that cannot be signed simply has no link. */
export async function signProjectFiles(service: SupabaseClient<Database>, files: Pick<ProjectFile, "path">[]): Promise<Map<string, string>> {
  const paths = [...new Set(files.map((f) => f.path))];
  if (paths.length === 0) return new Map();
  const { data } = await service.storage.from(PROJECT_BUCKET).createSignedUrls(paths, SIGNED_SECONDS);
  const out = new Map<string, string>();
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}
