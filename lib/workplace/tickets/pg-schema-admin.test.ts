import { describe } from "vitest";
import { PG_ADMIN } from "./pg-admin";
import { PG_SCHEMA } from "./pg-schema";
import { checkPgTemplates } from "./pg-check";

describe("PostgreSQL schema and security tickets", () => checkPgTemplates([...PG_SCHEMA, ...PG_ADMIN]));
