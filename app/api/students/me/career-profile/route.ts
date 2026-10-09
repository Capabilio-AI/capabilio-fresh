import { assessRoute } from "@/lib/assess/http";
import { getCareerProfile } from "@/lib/assess/career-profile";

/** The one endpoint behind the popup, the dashboard ELO card, the Skills section and the Skill Graph tab. */
export const GET = assessRoute("career_profile", 120, async (_req, { userId, db }) => getCareerProfile(db, userId), { memoryLimit: true });
