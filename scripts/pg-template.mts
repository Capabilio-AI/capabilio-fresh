/**
 * Builds the PGlite starting snapshot (an initialised Postgres data directory). Booting from it takes under a second;
 * initialising from scratch takes 3-10 seconds. Re-run after changing the @electric-sql/pglite version:
 *   npm run pg:template
 */
import { writeFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const OUT = "lib/workplace/sql/assets/pg-template.tgz";
const db = new PGlite();
await db.waitReady;
const blob = await db.dumpDataDir("gzip");
writeFileSync(OUT, Buffer.from(await blob.arrayBuffer()));
const [{ version }] = (await db.query<{ version: string }>("SELECT version()")).rows;
await db.close();
console.log(`wrote ${OUT}\n${version}`);
