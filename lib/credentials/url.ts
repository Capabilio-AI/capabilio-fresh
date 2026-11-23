import { headers } from "next/headers";

/**
 * The address a credential's QR code points to. A printed certificate must point at the real site, so the configured site address wins; only when it is
 * not set does it use the host the student is on now (which is right for local development and previews).
 */
export async function credentialUrl(code: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}/verify/${code}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/verify/${code}`;
}
