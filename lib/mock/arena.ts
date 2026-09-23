// DEV MOCK DATA — Arena Projects and Competitions have no backend tables yet
// (no `projects`, `project_milestones`, or `competitions` tables exist).
// Isolated here so it's obvious what to replace once those tables land —
// see the Database Migrations note in the final report.

export interface MockArenaProject {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedHours: number;
}

export const MOCK_ARENA_PROJECTS: MockArenaProject[] = [
  {
    id: "retail-sales-analysis",
    title: "Retail Sales Analysis Dashboard",
    summary: "Clean a messy retail dataset and ship an interactive dashboard of sales trends by region.",
    skills: ["SQL", "Data Visualization", "Python"],
    difficulty: "Beginner",
    estimatedHours: 8,
  },
  {
    id: "campus-event-api",
    title: "Campus Event Booking API",
    summary: "Design and build a REST API for event registration with seat limits and waitlists.",
    skills: ["API Design", "Databases", "Backend Fundamentals"],
    difficulty: "Intermediate",
    estimatedHours: 14,
  },
  {
    id: "resume-parser",
    title: "Resume Skill Extractor",
    summary: "Parse resumes into structured skill data using regex and a small NLP pipeline.",
    skills: ["Python", "Text Processing", "Data Structures"],
    difficulty: "Advanced",
    estimatedHours: 20,
  },
];

export interface MockCompetition {
  id: string;
  title: string;
  organizer: string;
  skills: string[];
  deadline: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  teamSize: string;
}

export const MOCK_COMPETITIONS: MockCompetition[] = [
  {
    id: "smart-india-prep",
    title: "Smart India Hackathon — Prep Sprint",
    organizer: "Capabilio community",
    skills: ["Problem Solving", "Rapid Prototyping"],
    deadline: "2026-11-15",
    difficulty: "Intermediate",
    teamSize: "2-4 students",
  },
  {
    id: "campus-datathon",
    title: "Inter-College Datathon",
    organizer: "Capabilio community",
    skills: ["SQL", "Data Visualization"],
    deadline: "2026-10-20",
    difficulty: "Beginner",
    teamSize: "Solo or pairs",
  },
];
