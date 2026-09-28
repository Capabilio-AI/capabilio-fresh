import { randomBytes } from "node:crypto";

/** A short code the student adds to their public GitHub bio temporarily, to prove they own the account — no OAuth needed. */
export function generateVerificationCode(): string {
  return `capabilio-verify-${randomBytes(4).toString("hex")}`;
}
