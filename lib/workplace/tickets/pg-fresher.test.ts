import { describe } from "vitest";
import { PG_FRESHER } from "./pg-fresher";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL everyday tickets (fresher and junior)", () => checkPgTemplates(PG_FRESHER));
