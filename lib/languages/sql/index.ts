import type { Track } from "../types";
import { queries } from "./m1-queries";
import { joins, subqueries } from "./m2-joins-subqueries";
import { windows, changing, design } from "./m3-windows-design";

export const sqlTrack: Track = {
  key: "sql",
  title: "SQL",
  runnerLanguage: "sql",
  tagline: "The language every data, backend and analytics role is tested on.",
  outcome: "Query, join, summarise and change data with confidence, use window functions and CTEs, and design tables that stay correct, ready for placement SQL rounds and real projects.",
  references: [
    { title: "PostgreSQL documentation: SQL language", url: "https://www.postgresql.org/docs/current/sql.html" },
    { title: "SQLite SQL reference", url: "https://www.sqlite.org/lang.html" },
    { title: "MySQL reference manual", url: "https://dev.mysql.com/doc/refman/8.0/en/" },
  ],
  modules: [queries, joins, subqueries, windows, changing, design],
};
