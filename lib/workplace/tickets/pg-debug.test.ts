import { describe } from "vitest";
import { PG_DEBUG } from "./pg-debug";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL debugging tickets", () => checkPgTemplates(PG_DEBUG));
