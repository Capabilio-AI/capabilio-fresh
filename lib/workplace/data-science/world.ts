import { BRIGHTCART, generateBrightCart } from "../worlds/brightcart";
import type { World } from "../worlds";
import { DS_STATS_TEMPLATES, DS_STORY_TEMPLATES } from "./world-templates";

/**
 * The Data Scientist works on the same fictional company data as the Data Analyst (BrightCart, SQLite), but only with its own statistics and
 * storytelling tickets: no SQL, spreadsheet, cleaning or dashboard tickets, and none of the Data Analyst's investigations. Registered for the
 * role key "data-scientist" in lib/workplace/worlds/index.ts.
 */
export const DATA_SCIENCE_WORLD: World = {
  key: `${BRIGHTCART.key}-ds`,
  name: BRIGHTCART.name,
  engine: "sqlite",
  generate: generateBrightCart,
  templates: [],
  office: { sheets: [], cleaning: [], dashboards: [], statistics: DS_STATS_TEMPLATES },
  investigations: DS_STORY_TEMPLATES,
  stories: [
    { title: "Experiment review week", blurb: "Product has three tests waiting for a verdict. Each needs a clear, defensible answer before anything ships." },
    { title: "Model refresh", blurb: "The risk and retention models are due for a refresh. Features, metrics and thresholds all need a second look." },
    { title: "Quarterly business review", blurb: "Leadership wants the story behind the numbers: what moved, why, and how sure we are." },
  ],
};
