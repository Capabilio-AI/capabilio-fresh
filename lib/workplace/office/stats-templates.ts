import type { StatQuestion } from "@/lib/arena-workstations/engines/stats";
import { BRIGHTCART } from "../worlds/brightcart";
import { orderStatsTable } from "./data";
import type { StatsDraft, StatsTemplate } from "./types";

const { cast } = BRIGHTCART;
const AREAS = ["statistics"];

type Spec = Pick<StatsTemplate, "id" | "difficulty" | "minLevel">;
const D: Record<string, Spec> = {
  basket: { id: "stat-basket-summary", difficulty: "easy", minLevel: "fresher" },
  spread: { id: "stat-spread", difficulty: "easy", minLevel: "fresher" },
  tenure: { id: "stat-tenure-and-basket", difficulty: "medium", minLevel: "fresher" },
  interval: { id: "stat-order-interval", difficulty: "medium", minLevel: "junior" },
  correlation: { id: "stat-correlation", difficulty: "medium", minLevel: "junior" },
  regression: { id: "stat-regression", difficulty: "hard", minLevel: "mid" },
  experiment: { id: "stat-channel-returns-test", difficulty: "hard", minLevel: "mid" },
};

const make = (s: Spec, draft: Omit<StatsDraft, "templateId" | "difficulty" | "minLevel">): StatsDraft => ({ templateId: s.id, difficulty: s.difficulty, minLevel: s.minLevel, ...draft });
const DELIVERED = { statuses: ["delivered"] } as const;

export const STATS_TEMPLATES: StatsTemplate[] = [
  {
    ...D.basket, areas: AREAS,
    build(rng, tables) {
      return make(D.basket, {
        title: "What does a typical order look like?", requester: cast.finance, skillTags: ["Statistics", "Mean", "Median"],
        scenario: "Hi, I'm preparing the investor pack and need to describe our typical delivered order honestly. Please work out the average order value and the median order value from this sample, so we can see whether a few big orders pull the average up.",
        dataset: orderStatsTable(tables, rng, 60, DELIVERED),
        questions: [{ id: "q1", statistic: "mean", column: "order_value" }, { id: "q2", statistic: "median", column: "order_value" }],
      });
    },
  },
  {
    ...D.spread, areas: AREAS,
    build(rng, tables) {
      return make(D.spread, {
        title: "How much do order values vary?", requester: cast.sales, skillTags: ["Statistics", "Standard deviation", "Median"],
        scenario: "Hello, I want to know how spread out our order values are, because it decides how reliable a monthly forecast can be. Give me the sample standard deviation of the order value, and how long customers typically wait before their first order after signing up (the median).",
        dataset: orderStatsTable(tables, rng, 70, DELIVERED),
        questions: [{ id: "q1", statistic: "sample_std", column: "order_value" }, { id: "q2", statistic: "median", column: "days_since_signup" }],
      });
    },
  },
  {
    ...D.tenure, areas: AREAS,
    build(rng, tables) {
      return make(D.tenure, {
        title: "Do longer-standing customers spend more?", requester: cast.marketing, skillTags: ["Statistics", "Correlation", "Mean"],
        scenario: "Hi, I'd like a first look before we plan a loyalty offer. Tell me how strongly the days since a customer signed up move together with the value of their order (the correlation), and the average number of lines per order.",
        dataset: orderStatsTable(tables, rng, 60, DELIVERED),
        questions: [{ id: "q1", statistic: "pearson_r", x_column: "days_since_signup", y_column: "order_value" }, { id: "q2", statistic: "mean", column: "items" }],
      });
    },
  },
  {
    ...D.interval, areas: AREAS,
    build(rng, tables) {
      return make(D.interval, {
        title: "How sure can we be about the average order value?", requester: cast.finance, skillTags: ["Statistics", "Confidence interval", "Mean"],
        scenario: "Hi, I only have a sample of orders, not all of them. Finance wants the average order value with a range we can defend, not just one number. Please give the 95% confidence interval for the mean order value, and the mean number of lines per order.",
        dataset: orderStatsTable(tables, rng, 80, DELIVERED),
        questions: [{ id: "q1", statistic: "ci95_mean", column: "order_value" }, { id: "q2", statistic: "mean", column: "items" }],
      });
    },
  },
  {
    ...D.correlation, areas: AREAS,
    build(rng, tables) {
      return make(D.correlation, {
        title: "Do bigger baskets mean bigger orders?", requester: cast.marketing, skillTags: ["Statistics", "Correlation", "Median"],
        scenario: "Hello, we are thinking of a 'add one more item' nudge at checkout. Before we build it, tell me how strongly the number of lines on an order moves together with its value (the correlation), and what the median order value is.",
        dataset: orderStatsTable(tables, rng, 90, DELIVERED),
        questions: [{ id: "q1", statistic: "pearson_r", x_column: "items", y_column: "order_value" }, { id: "q2", statistic: "median", column: "order_value" }],
      });
    },
  },
  {
    ...D.regression, areas: AREAS,
    build(rng, tables) {
      return make(D.regression, {
        title: "What is one more item on an order worth?", requester: cast.data, skillTags: ["Statistics", "Regression", "Correlation"],
        scenario: "Hi, I'm modelling revenue per basket. Fit a straight line of order value against the number of lines, so I can say what each extra line adds on average. Also tell me whether customers who have been with us longer spend more, using the correlation between days since signup and order value.",
        dataset: orderStatsTable(tables, rng, 100, DELIVERED),
        questions: [{ id: "q1", statistic: "regression", x_column: "items", y_column: "order_value" }, { id: "q2", statistic: "pearson_r", x_column: "days_since_signup", y_column: "order_value" }],
      });
    },
  },
  {
    ...D.experiment, areas: AREAS,
    build(rng, tables) {
      const [a, b] = rng.shuffle(["app", "web", "marketplace"]).slice(0, 2).sort();
      return make(D.experiment, {
        title: `Is the return rate really different on ${a} and ${b}?`, requester: cast.success, skillTags: ["Statistics", "Hypothesis testing", "Two-proportion test"],
        scenario: `Hello, returns look higher on one of these two channels, but I don't want to act on noise. Compare the return rate of ${a} and ${b} orders with a proper test and tell me whether the difference is significant.`,
        dataset: orderStatsTable(tables, rng, 200, { statuses: ["delivered", "returned"], channels: [a, b] }),
        questions: [{ id: "q1", statistic: "two_proportion_test", group_column: "channel", outcome_column: "returned" } satisfies StatQuestion],
      });
    },
  },
];
