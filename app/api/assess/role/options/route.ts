import { assessRoute } from "@/lib/assess/http";
import { loadRoleOptions } from "@/lib/assess/roles";

/** Every selectable role with its aliases, for pickers that suggest roles as the student types. */
export const GET = assessRoute("assess_role_options", 20, async (_req, { db }) => ({ roles: await loadRoleOptions(db) }));
