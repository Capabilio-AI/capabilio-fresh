// Creates the Ed25519 key that signs Capabilio credentials, ONCE.
//   npm run credentials:key
// It writes CREDENTIAL_SIGNING_KEY to .env.local (git-ignored) and copies the same value to the clipboard so it can be pasted into Vercel as a secret. It never prints the key.
// It refuses to run when a key already exists: replacing the key would make every credential already issued stop verifying.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { generateSigningKey } from "@/lib/credentials/sign";

const FILE = ".env.local";
if (existsSync(FILE) && /^CREDENTIAL_SIGNING_KEY=./m.test(readFileSync(FILE, "utf8"))) {
  console.error("A signing key is already set in .env.local. Not replacing it: credentials already issued would stop verifying.");
  process.exit(1);
}
const key = generateSigningKey();
appendFileSync(FILE, `\n# Signs Capabilio credentials (Ed25519). Keep secret; never change once credentials exist.\nCREDENTIAL_SIGNING_KEY=${key.envValue}\n`);
const copied = spawnSync("pbcopy", { input: key.envValue }).status === 0;
console.log(`Key created. Key id: ${key.keyId}`);
console.log(copied ? "The value is on your clipboard: paste it into Vercel as CREDENTIAL_SIGNING_KEY (mark it Sensitive)." : "Could not use the clipboard: read CREDENTIAL_SIGNING_KEY from .env.local and add it to Vercel.");
console.log(`Public key (safe to share):\n${key.publicPem}`);
