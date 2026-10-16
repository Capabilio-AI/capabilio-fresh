import { describe } from "vitest";
import { PG_DBA } from "./pg-dba";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL DBA tickets", () => checkPgTemplates(PG_DBA));
