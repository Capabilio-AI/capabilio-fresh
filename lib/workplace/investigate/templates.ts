import { BRIGHTCART } from "../worlds/brightcart";
import { detectDuplicateLoad, detectSegmentFault, detectUnitPriceBug, plantDuplicateLoad, plantSegmentFault, plantStaleStatus, plantUnitPriceBug, type Window } from "./faults";
import type { AnswerField, InvestigationDraft, InvestigationTemplate } from "./types";

const { cast } = BRIGHTCART;
const INVESTIGATE = ["investigation"];
const INCIDENT = ["incident"];

const quarter = (q: number): Window => ({ label: `Q${q} 2026`, start: `2026-0${(q - 1) * 3 + 1}-01`, end: q === 3 ? "2026-10-01" : `2026-0${q * 3 + 1}-01` });

const DIMENSION_LABEL = { channel: "channel", city: "city", segment: "customer segment" } as const;
const DIMENSION_OPTIONS = Object.values(DIMENSION_LABEL);
const FAULT_OPTIONS = ["Orders were loaded twice", "A product has the wrong unit price", "Order status stopped updating", "Orders are missing"];
const SEGMENTS = ["Premium", "Regular", "New"];

const impactField = (label: string): AnswerField => ({ key: "impact", label, type: "number", unit: "₹" });
const INCIDENT_FIELDS = (impact: string): AnswerField[] => [
  { key: "fault", label: "What is wrong with the data?", type: "choice", options: FAULT_OPTIONS },
  { key: "where", label: "Where is it?", help: "A date as YYYY-MM-DD, or a product name, whichever the fault points to.", type: "text", placeholder: "2026-05-14 or a product name" },
  impactField(impact),
];

export const INVESTIGATION_TEMPLATES: InvestigationTemplate[] = [
  {
    id: "detect-cancellation-spike", difficulty: "medium", minLevel: "junior", areas: INVESTIGATE,
    build(rng, tables) {
      const w = quarter(rng.int(1, 3));
      const planted = plantSegmentFault(tables, rng, { window: w, status: "cancelled", dimensions: ["channel", "city", "segment"] });
      if (!planted) return null;
      const found = detectSegmentFault(planted.tables, w, "cancelled")!;
      const [part] = found.parts;
      return {
        templateId: "detect-cancellation-spike", mode: "detective", skillTags: ["Root-cause analysis", "SQL", "Segmentation"], difficulty: "medium", minLevel: "junior",
        title: `Delivered revenue fell short in ${w.label}: find out why`, requester: cast.sales,
        scenario: `Hi, delivered revenue in ${w.label} came in well below plan and customer success says cancellations are through the roof. I don't know whether it's one sales channel, one city or one kind of customer. Please investigate in the data, tell me where the problem is and how much revenue is sitting in the cancelled orders there.`,
        tables: planted.tables,
        fields: [
          { key: "dimension", label: "Which way of splitting the business shows the problem?", type: "choice", options: DIMENSION_OPTIONS },
          { key: "value", label: "Which one is it?", help: "For example a channel name, a city or a customer segment.", type: "text", placeholder: "the name of the channel, city or segment" },
          impactField(`How much revenue is in that group's cancelled orders in ${w.label}?`),
        ],
        answers: { dimension: DIMENSION_LABEL[part.dimension], value: part.value, impact: found.impact }, tolerance: { impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "detect-refund-spike", difficulty: "medium", minLevel: "junior", areas: INVESTIGATE,
    build(rng, tables) {
      const w = quarter(rng.int(1, 3));
      const planted = plantSegmentFault(tables, rng, { window: w, status: "returned", dimensions: ["channel", "city", "segment"] });
      if (!planted) return null;
      const found = detectSegmentFault(planted.tables, w, "returned")!;
      const [part] = found.parts;
      return {
        templateId: "detect-refund-spike", mode: "detective", skillTags: ["Root-cause analysis", "SQL", "Segmentation"], difficulty: "medium", minLevel: "junior",
        title: `Refunds jumped in ${w.label}: where are they coming from?`, requester: cast.finance,
        scenario: `Hello, the refund provision for ${w.label} is far higher than usual and the board wants an explanation. Returned orders are not spread evenly. Find which part of the business they come from and how much revenue those returned orders represent.`,
        tables: planted.tables,
        fields: [
          { key: "dimension", label: "Which way of splitting the business shows the problem?", type: "choice", options: DIMENSION_OPTIONS },
          { key: "value", label: "Which one is it?", help: "For example a channel name, a city or a customer segment.", type: "text", placeholder: "the name of the channel, city or segment" },
          impactField(`How much revenue is in that group's returned orders in ${w.label}?`),
        ],
        answers: { dimension: DIMENSION_LABEL[part.dimension], value: part.value, impact: found.impact }, tolerance: { impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "detect-hidden-combination", difficulty: "hard", minLevel: "mid", areas: INVESTIGATE,
    build(rng, tables) {
      const w = quarter(rng.int(1, 3));
      const planted = plantSegmentFault(tables, rng, { window: w, status: "returned", dimensions: ["channel", "segment"], combine: true });
      if (!planted) return null;
      const found = detectSegmentFault(planted.tables, w, "returned", true)!;
      const channel = found.parts.find((p) => p.dimension === "channel")!.value;
      const segment = found.parts.find((p) => p.dimension === "segment")!.value;
      return {
        templateId: "detect-hidden-combination", mode: "detective", skillTags: ["Root-cause analysis", "SQL", "Multi-dimensional analysis"], difficulty: "hard", minLevel: "mid",
        title: `Returns look normal everywhere, yet ${w.label} is worse: dig deeper`, requester: cast.success,
        scenario: `Hi, returns in ${w.label} are clearly up, but when I look at any single channel, city or customer group nothing stands out. My hunch is that the problem sits where two of them meet. Please find it and tell me how much revenue is in the returned orders there.`,
        tables: planted.tables,
        fields: [
          { key: "channel", label: "Which sales channel?", type: "text", placeholder: "channel name" },
          { key: "segment", label: "Which customer segment?", type: "choice", options: SEGMENTS },
          impactField(`How much revenue is in the returned orders of that channel and segment in ${w.label}?`),
        ],
        answers: { channel, segment, impact: found.impact }, tolerance: { impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "incident-duplicate-load", difficulty: "hard", minLevel: "mid", areas: INCIDENT,
    build(rng, tables) {
      const planted = plantDuplicateLoad(tables, rng);
      if (!planted) return null;
      return {
        templateId: "incident-duplicate-load", mode: "incident", skillTags: ["Data quality", "Incident analysis", "SQL"], difficulty: "hard", minLevel: "mid",
        title: "Incident: one day's revenue on the dashboard looks far too high", requester: cast.finance,
        scenario: "Hi, urgent: the revenue dashboard shows an unusually high spike for one day and finance says the ledger does not agree. Something went wrong in the data. I need to know what, where it is, and how much delivered revenue the dashboard is overstating because of it.",
        tables: planted.tables, fields: INCIDENT_FIELDS("By how much (₹, delivered orders) is the dashboard overstated?"),
        answers: { fault: FAULT_OPTIONS[0], where: planted.date, impact: planted.overstated }, tolerance: { impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "incident-unit-price", difficulty: "hard", minLevel: "mid", areas: INCIDENT,
    build(rng, tables) {
      const planted = plantUnitPriceBug(tables, rng);
      if (!planted) return null;
      return {
        templateId: "incident-unit-price", mode: "incident", skillTags: ["Data quality", "Incident analysis", "SQL"], difficulty: "hard", minLevel: "mid",
        title: "Incident: revenue jumped but the units sold did not", requester: cast.data,
        scenario: "Hello, since a catalogue sync some days ago our revenue has climbed sharply while units sold are flat. That makes no sense. Please find what is wrong in the data, point to where it is, and work out how much delivered revenue is overstated.",
        tables: planted.tables, fields: INCIDENT_FIELDS("By how much (₹, delivered orders) is revenue overstated?"),
        answers: { fault: FAULT_OPTIONS[1], where: planted.product, impact: planted.overstated }, tolerance: { impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "incident-stale-status", difficulty: "medium", minLevel: "mid", areas: INCIDENT,
    build(rng, tables) {
      const planted = plantStaleStatus(tables, rng);
      if (!planted) return null;
      return {
        templateId: "incident-stale-status", mode: "incident", skillTags: ["Data quality", "Incident analysis", "SQL"], difficulty: "medium", minLevel: "mid",
        title: "Incident: delivered revenue has flatlined but orders keep coming", requester: cast.success,
        scenario: "Hi, the delivered-revenue line on our dashboard has gone flat although customers keep ordering. Something stopped marking orders as delivered. Find the last day an order was delivered, and tell me the total value of the orders that have been stuck at 'shipped' since that day.",
        tables: planted.tables,
        fields: [
          { key: "fault", label: "What is wrong with the data?", type: "choice", options: FAULT_OPTIONS },
          { key: "where", label: "On which date was the last order delivered?", help: "As YYYY-MM-DD.", type: "text", placeholder: "YYYY-MM-DD" },
          impactField("What is the total value of orders with status 'shipped' dated after that day?"),
        ],
        answers: { fault: FAULT_OPTIONS[2], where: planted.lastDelivered, impact: planted.stuckRevenue }, tolerance: { impact: 1 },
      } satisfies InvestigationDraft;
    },
  },
  {
    id: "incident-compound", difficulty: "hard", minLevel: "expert", areas: INCIDENT,
    build(rng, tables) {
      // two unrelated faults at once; they must not touch the same lines, or the two overstatements could not be told apart
      const price = plantUnitPriceBug(tables, rng);
      if (!price) return null;
      const dup = plantDuplicateLoad(price.tables, rng);
      if (!dup) return null;
      const priceNow = detectUnitPriceBug(dup.tables);
      const dupNow = detectDuplicateLoad(dup.tables);
      if (!priceNow || !dupNow || priceNow.overstated !== price.overstated || dupNow.date !== dup.date) return null;
      return {
        templateId: "incident-compound", mode: "incident", skillTags: ["Data quality", "Incident analysis", "SQL", "Multiple root causes"], difficulty: "hard", minLevel: "expert",
        title: "Incident: the dashboard is wrong in two different ways", requester: cast.data,
        scenario: "Hi, the revenue dashboard is off and finance now believes there is more than one cause. A recent catalogue sync and a loader retry both look suspicious, but I do not know whether either is real or whether they overlap. Please find every fault, say exactly where each is, and give the overstatement each one causes on its own.",
        tables: dup.tables,
        fields: [
          { key: "duplicate_date", label: "On which date were orders loaded twice?", help: "As YYYY-MM-DD.", type: "text", placeholder: "YYYY-MM-DD" },
          impactField("By how much (₹, delivered orders) does the double load overstate revenue?"),
          { key: "price_product", label: "Which product has the wrong unit price?", type: "text", placeholder: "product name" },
          { key: "impact_price", label: "By how much (₹, delivered orders) does that price overstate revenue?", type: "number", unit: "₹" },
        ],
        answers: { duplicate_date: dupNow.date, impact: dupNow.overstated, price_product: priceNow.product, impact_price: priceNow.overstated }, tolerance: { impact: 1, impact_price: 1 },
      } satisfies InvestigationDraft;
    },
  },
];
