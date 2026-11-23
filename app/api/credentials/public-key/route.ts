import { NextResponse } from "next/server";
import { loadKeys } from "@/lib/credentials/sign";

/** The public half of the signing key, so anyone can check a credential without trusting our database. It holds nothing secret. */
export function GET() {
  const keys = loadKeys(process.env.CREDENTIAL_SIGNING_KEY);
  if (!keys) return NextResponse.json({ error: "Credentials are not switched on." }, { status: 503 });
  return NextResponse.json({ algorithm: "Ed25519", keyId: keys.keyId, publicKeyPem: keys.publicPem, signs: "the canonical JSON payload of a credential, signature in base64url" }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
