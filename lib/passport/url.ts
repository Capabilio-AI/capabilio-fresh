import { headers } from "next/headers";

/** The public address a passport QR points to, built from the host the student is using right now. */
export async function passportUrl(code: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/passport/${code}`;
}
