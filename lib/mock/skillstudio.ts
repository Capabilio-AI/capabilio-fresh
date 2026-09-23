// DEV MOCK DATA — SkillStudio's Foundations/Courses/Certifications catalogs
// have no backend tables yet (no `content_items`, `courses`, or
// `certifications` tables exist). Isolated here so it's obvious what to
// replace once a real content catalog lands — see the Database Migrations
// note in the final report. "My Path" (app/(app)/skillstudio/page.tsx) is
// NOT mock — it reads the real guide_paths table via lib/guide-path/read.ts.

export type CatalogLevel = "Beginner" | "Intermediate" | "Advanced";

export interface MockFoundation {
  id: string;
  title: string;
  skill: string;
  description: string;
  level: CatalogLevel;
}

export const MOCK_FOUNDATIONS: MockFoundation[] = [
  {
    id: "quant-foundations",
    title: "Quantitative Reasoning Foundations",
    skill: "Quantitative Aptitude",
    description: "Number systems, ratios, and percentages — the base layer for every aptitude round.",
    level: "Beginner",
  },
  {
    id: "logic-foundations",
    title: "Logical Reasoning Foundations",
    skill: "Logical Reasoning",
    description: "Pattern recognition, syllogisms, and sequences.",
    level: "Beginner",
  },
  {
    id: "programming-foundations",
    title: "Programming Fundamentals",
    skill: "Programming Fundamentals",
    description: "Variables, control flow, and functions in a language-agnostic way.",
    level: "Beginner",
  },
  {
    id: "data-structures-foundations",
    title: "Data Structures Foundations",
    skill: "Data Structures",
    description: "Arrays, lists, stacks, and queues — how data is actually stored and moved.",
    level: "Intermediate",
  },
];

export interface MockCourse {
  id: string;
  title: string;
  provider: string;
  skills: string[];
  durationHours: number;
  level: CatalogLevel;
}

export const MOCK_COURSES: MockCourse[] = [
  {
    id: "sql-for-analysis",
    title: "SQL for Data Analysis",
    provider: "Capabilio Learn",
    skills: ["SQL", "Data Visualization"],
    durationHours: 6,
    level: "Beginner",
  },
  {
    id: "api-design-course",
    title: "Practical API Design",
    provider: "Capabilio Learn",
    skills: ["API Design", "Backend Fundamentals"],
    durationHours: 10,
    level: "Intermediate",
  },
  {
    id: "python-for-engineers",
    title: "Python for Engineering Students",
    provider: "Capabilio Learn",
    skills: ["Python", "Programming Fundamentals"],
    durationHours: 8,
    level: "Beginner",
  },
  {
    id: "ds-algo-course",
    title: "Data Structures & Algorithms Primer",
    provider: "Capabilio Learn",
    skills: ["Data Structures", "Python"],
    durationHours: 12,
    level: "Intermediate",
  },
];

export interface MockCertification {
  id: string;
  title: string;
  issuer: string;
  skills: string[];
  level: CatalogLevel;
}

export const MOCK_CERTIFICATIONS: MockCertification[] = [
  {
    id: "sql-fundamentals-cert",
    title: "SQL Fundamentals",
    issuer: "Capabilio Learn",
    skills: ["SQL"],
    level: "Beginner",
  },
  {
    id: "api-design-cert",
    title: "API Design Practitioner",
    issuer: "Capabilio Learn",
    skills: ["API Design"],
    level: "Intermediate",
  },
  {
    id: "python-cert",
    title: "Python for Engineers",
    issuer: "Capabilio Learn",
    skills: ["Python"],
    level: "Beginner",
  },
];
