import type { TicketTemplate } from "../tickets/types";
import { KAVERI, MONTHS } from "./kaveri";

const { cast } = KAVERI;
const AREAS = ["data-queries"];
const MONTH_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September"];
const QUARTERS = [{ label: "Q1 2026", months: MONTHS.slice(0, 3) }, { label: "Q2 2026", months: MONTHS.slice(3, 6) }, { label: "Q3 2026", months: MONTHS.slice(6, 9) }];
const inList = (months: string[]) => months.map((m) => `'${m}'`).join(", ");

export const BUSINESS_SQL_TEMPLATES: TicketTemplate[] = [
  {
    id: "ba-sql-region-attainment", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: AREAS,
    build(rng) {
      const m = rng.int(0, MONTHS.length - 1);
      const where = `k.month = '${MONTHS[m]}'`;
      return {
        templateId: "ba-sql-region-attainment", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", kind: "query", requester: cast.regional, skillTags: ["SQL", "KPIs", "JOIN"],
        title: `Target attainment by region, ${MONTH_LABEL[m]}`,
        scenario: `Hi, for the review I need to know how each region did against its revenue target in ${MONTH_LABEL[m]} 2026. Attainment is total actual revenue as a percentage of total target.`,
        deliverable: `One row per region for month ${MONTHS[m]}: region, target (sum of target_revenue), actual (sum of actual_revenue) and attainment_pct (100 × actual ÷ target, rounded to 1 decimal).`,
        referenceQuery: `SELECT b.region, SUM(k.target_revenue) AS target, SUM(k.actual_revenue) AS actual, ROUND(100.0 * SUM(k.actual_revenue) / SUM(k.target_revenue), 1) AS attainment_pct FROM monthly_kpis k JOIN branches b ON b.branch_id = k.branch_id WHERE ${where} GROUP BY b.region`,
        mistakeQuery: `SELECT b.region, SUM(k.target_revenue) AS target, SUM(k.actual_revenue) AS actual, ROUND(100.0 * SUM(k.actual_revenue) / SUM(k.target_revenue), 1) AS attainment_pct FROM monthly_kpis k JOIN branches b ON b.branch_id = k.branch_id GROUP BY b.region`,
      };
    },
  },
  {
    id: "ba-sql-sla-breaches", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", areas: AREAS,
    build(rng) {
      const category = rng.pick(KAVERI.categories);
      return {
        templateId: "ba-sql-sla-breaches", difficulty: "easy", minLevel: "fresher", taskKind: "retrieval", kind: "query", requester: cast.cx, skillTags: ["SQL", "SLA", "GROUP BY"],
        title: `Where are ${category} jobs breaching SLA?`,
        scenario: `Hello, I keep hearing that ${category} visits run late. A breach is a closed request whose resolution_hours is more than its sla_hours. Which cities have breaches, and how many?`,
        deliverable: `One row per city that has at least one breach: city and breaches (number of closed ${category} requests with resolution_hours > sla_hours).`,
        referenceQuery: `SELECT b.city, COUNT(*) AS breaches FROM service_requests r JOIN branches b ON b.branch_id = r.branch_id WHERE r.status = 'closed' AND r.category = '${category}' AND r.resolution_hours > r.sla_hours GROUP BY b.city`,
        mistakeQuery: `SELECT b.city, COUNT(*) AS breaches FROM service_requests r JOIN branches b ON b.branch_id = r.branch_id WHERE r.status = 'closed' AND r.resolution_hours > r.sla_hours GROUP BY b.city`,
      };
    },
  },
  {
    id: "ba-sql-channel-roi", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", areas: AREAS,
    build() {
      return {
        templateId: "ba-sql-channel-roi", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", kind: "query", requester: cast.marketing, skillTags: ["SQL", "ROI", "Aggregation"],
        title: "Which marketing channel pays back best?",
        scenario: "Hi, finance wants ROI per channel, not per campaign. ROI is (total revenue − total spend) ÷ total spend for the channel. Averaging each campaign's ROI is not the same thing, so please don't do that.",
        deliverable: "One row per channel: channel, spend (sum), revenue (sum) and roi_pct (100 × (revenue − spend) ÷ spend, rounded to 1 decimal), highest roi_pct first.",
        referenceQuery: "SELECT channel, SUM(spend) AS spend, SUM(revenue) AS revenue, ROUND(100.0 * (SUM(revenue) - SUM(spend)) / SUM(spend), 1) AS roi_pct FROM campaigns GROUP BY channel ORDER BY roi_pct DESC",
        mistakeQuery: "SELECT channel, SUM(spend) AS spend, SUM(revenue) AS revenue, ROUND(AVG(100.0 * (revenue - spend) / spend), 1) AS roi_pct FROM campaigns GROUP BY channel ORDER BY roi_pct DESC",
      };
    },
  },
  {
    id: "ba-sql-below-target", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", areas: AREAS,
    build(rng) {
      const q = rng.pick(QUARTERS);
      const body = `FROM monthly_kpis k JOIN branches b ON b.branch_id = k.branch_id WHERE k.month IN (${inList(q.months)})`;
      return {
        templateId: "ba-sql-below-target", difficulty: "medium", minLevel: "fresher", taskKind: "analytics", kind: "query", requester: cast.ops, skillTags: ["SQL", "HAVING", "Variance"],
        title: `Branches that missed their ${q.label} target`,
        scenario: `Hi, I want to call the branches that missed target over the whole of ${q.label}. A branch can miss one month and still make the quarter, so judge each branch on its quarter totals.`,
        deliverable: `One row per branch whose total actual_revenue for ${q.label} (months ${q.months.join(", ")}) is below its total target_revenue: branch_name, target, actual and shortfall (target − actual), largest shortfall first.`,
        referenceQuery: `SELECT b.branch_name, SUM(k.target_revenue) AS target, SUM(k.actual_revenue) AS actual, SUM(k.target_revenue) - SUM(k.actual_revenue) AS shortfall ${body} GROUP BY b.branch_id, b.branch_name HAVING SUM(k.actual_revenue) < SUM(k.target_revenue) ORDER BY shortfall DESC`,
        mistakeQuery: `SELECT b.branch_name, SUM(k.target_revenue) AS target, SUM(k.actual_revenue) AS actual, SUM(k.target_revenue) - SUM(k.actual_revenue) AS shortfall ${body} AND k.actual_revenue < k.target_revenue GROUP BY b.branch_id, b.branch_name ORDER BY shortfall DESC`,
      };
    },
  },
];
