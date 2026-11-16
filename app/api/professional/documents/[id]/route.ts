import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";
import { AssessError } from "@/lib/assess/types";
import { SHARES, type Share } from "@/lib/professional/documents";
import { unwrap } from "@/lib/professional/respond";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";
import { docLink, removeDoc, setDocShare } from "@/lib/professional/workspace-server";

/** Opens a document: a one-minute link to the file, for its owner only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  let id: string;
  try { id = idOf((await params).id); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const url = await docLink(auth.userId, id);
  return url ? NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "That document was not found." }, { status: 404 });
}

export const PUT = proRoute<{ id: string }>("pro_document_share", 30, async (req, { userId, params }) => {
  const id = idOf(params.id);
  const share = ((await jsonBody(req)) as { share?: unknown })?.share;
  if (typeof share !== "string" || !(SHARES as readonly string[]).includes(share)) throw new AssessError("INVALID_REQUEST", "Choose who can see it.", 400);
  return unwrap(await setDocShare(userId, id, share as Share));
});

export const DELETE = proRoute<{ id: string }>("pro_document_delete", 20, async (_req, { userId, params }) => unwrap(await removeDoc(userId, idOf(params.id))));
