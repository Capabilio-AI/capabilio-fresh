import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify, type KeyObject } from "node:crypto";

export interface CredentialKeys { privateKey: KeyObject; publicKey: KeyObject; publicPem: string; keyId: string }

const b64url = (b: Buffer) => b.toString("base64url");

/** Reads the signing key from the environment: a PEM (PKCS8) or the same PEM in base64 so it fits on one line. Null when it is not set or not an Ed25519 key. */
export function loadKeys(raw: string | undefined): CredentialKeys | null {
  if (!raw?.trim()) return null;
  try {
    const pem = raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8");
    const privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    const publicKey = createPublicKey(privateKey);
    const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    return { privateKey, publicKey, publicPem, keyId: keyIdOf(publicKey) };
  } catch { return null; }
}

/** The first 12 hex characters of the SHA-256 of the public key: names a key so a credential says which one signed it. */
export const keyIdOf = (publicKey: KeyObject): string => createHash("sha256").update(publicKey.export({ type: "spki", format: "der" })).digest("hex").slice(0, 12);

/** A new Ed25519 key pair as the single-line base64 text the environment variable holds, and its public PEM. Used once, by the setup script. */
export function generateSigningKey(): { envValue: string; publicPem: string; keyId: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return { envValue: Buffer.from(pem).toString("base64"), publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(), keyId: keyIdOf(publicKey) };
}

/** Signs the text; the signature is base64url. */
export const signText = (keys: CredentialKeys, text: string): string => b64url(sign(null, Buffer.from(text, "utf8"), keys.privateKey));

/** Whether the signature is a valid signature of the text by the key. Never throws: a malformed signature is simply not valid. */
export function verifyText(publicKey: KeyObject, text: string, signature: string): boolean {
  try { return verify(null, Buffer.from(text, "utf8"), publicKey, Buffer.from(signature, "base64url")); } catch { return false; }
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O or U, so a code read aloud or from print is not misread

/** A new public code: CAP- and four groups of four characters, 80 random bits, so a code cannot be guessed or counted. */
export function newCredentialCode(): string {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]);
  return `CAP-${[0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-")}`;
}
