import { describe } from "vitest";
import { PG_ENGINEERING } from "./pg-engineering";
import { PG_QUERIES } from "./pg-queries";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL data engineering and analytics tickets", () => checkPgTemplates([...PG_ENGINEERING, ...PG_QUERIES]));
