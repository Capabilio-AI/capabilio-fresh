import { PG_ADMIN } from "./pg-admin";
import { PG_DBA } from "./pg-dba";
import { PG_DEBUG } from "./pg-debug";
import { PG_FRESHER } from "./pg-fresher";
import { PG_ENGINEERING } from "./pg-engineering";
import { PG_EXPERT } from "./pg-expert";
import { PG_PROGRAMMABILITY } from "./pg-programmability";
import { PG_QUERIES } from "./pg-queries";
import { PG_SCHEMA } from "./pg-schema";
import type { TicketTemplate } from "./types";

export { PG_WORLD_SETUP } from "./pg-support";
export const BRIGHTCART_PG_TEMPLATES: readonly TicketTemplate[] = [...PG_QUERIES, ...PG_PROGRAMMABILITY, ...PG_SCHEMA, ...PG_ADMIN, ...PG_ENGINEERING, ...PG_FRESHER, ...PG_DBA, ...PG_DEBUG, ...PG_EXPERT];
