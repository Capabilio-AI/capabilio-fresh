import { randomBytes } from "crypto";

/** Opaque, unguessable, URL-safe — never derived from the user's name or id. */
export function generatePortfolioSlug(): string {
  return randomBytes(9).toString("base64url");
}
