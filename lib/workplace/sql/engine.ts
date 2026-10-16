import { runSqlQueries } from "@/lib/arena-workstations/engines/sql-runner";
import type { Dialect } from "@/lib/arena-workstations/engines/seed-sql";
import { runSqlScript } from "./local-runner";
import { runPgQueries, runPgScript } from "./pg-runner";
import type { Runners } from "../tickets/pick";

export type EngineKey = Dialect;

export interface Engine {
  key: EngineKey;
  /** shown to the user */
  label: string;
  runners: Runners;
}

/** The two database engines a ticket can run on. SQLite is instant; Postgres is real PostgreSQL (stored functions, triggers, privileges). */
export const ENGINES: Record<EngineKey, Engine> = {
  sqlite: { key: "sqlite", label: "SQLite", runners: { query: runSqlQueries, script: (seed, script, probes) => runSqlScript(seed, script, probes) } },
  postgres: { key: "postgres", label: "PostgreSQL", runners: { query: (seed, queries) => runPgQueries(seed, queries), script: (seed, script, probes) => runPgScript(seed, script, probes) } },
};

export const engineOf = (key: string | undefined): Engine => ENGINES[key === "postgres" ? "postgres" : "sqlite"];
