import { describe } from "vitest";
import { PG_EXPERT } from "./pg-expert";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL expert tickets", () => checkPgTemplates(PG_EXPERT));
