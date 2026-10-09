import { assessRoute } from "@/lib/assess/http";
import { addProofOfWork, listProofOfWork } from "@/lib/assess/proof";

export const GET = assessRoute("proof_list", 60, async (_req, { userId, db }) => ({ items: await listProofOfWork(db, userId) }));

/** The student is always the session user; verification_status cannot be set by the body (strict schema + DB default). */
export const POST = assessRoute("proof_add", 20, async (req, { userId, db }) => ({ item: await addProofOfWork(db, userId, await req.json().catch(() => ({}))) }));
