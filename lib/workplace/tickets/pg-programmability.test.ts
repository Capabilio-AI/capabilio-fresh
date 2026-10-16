import { describe } from "vitest";
import { PG_PROGRAMMABILITY } from "./pg-programmability";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL programmability tickets", () => checkPgTemplates(PG_PROGRAMMABILITY));
