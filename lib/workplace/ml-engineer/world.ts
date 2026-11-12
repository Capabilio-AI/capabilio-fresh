import { BRIGHTCART, generateBrightCart } from "../worlds/brightcart";
import type { World } from "../worlds";
import { ML_ENGINEER_SQL_TEMPLATES } from "./sql-templates";

/**
 * The AI/ML Engineer's data tickets run on the same fictional BrightCart warehouse as the Data Analyst (SQLite), with only its own label and feature
 * tickets (sql-templates.ts). Registered for the role key "ai-ml-engineer" in lib/workplace/worlds/index.ts.
 */
export const ML_ENGINEER_WORLD: World = {
  key: `${BRIGHTCART.key}-ml`,
  name: BRIGHTCART.name,
  engine: "sqlite",
  generate: generateBrightCart,
  templates: ML_ENGINEER_SQL_TEMPLATES,
  stories: [
    { title: "Churn model refresh", blurb: "The retention model is due for a refresh. Labels, features and the split all have to be rebuilt without leaking the future." },
    { title: "New recommendation model", blurb: "Product wants a first recommender. The team needs clean customer and order features before anyone trains anything." },
  ],
};
