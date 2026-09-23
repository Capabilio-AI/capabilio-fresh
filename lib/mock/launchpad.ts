// DEV MOCK DATA — Launchpad opportunities have no backend table yet (no
// `opportunities` table exists). Isolated here so it's obvious what to
// replace once a real opportunities feed lands — see the Database
// Migrations note in the final report. Never fabricate this kind of data
// directly in a page/presentation component.

export type OpportunityType = "Job" | "Internship" | "Competition" | "Referral";

export interface MockOpportunity {
  id: string;
  role: string;
  company: string;
  location: string;
  type: OpportunityType;
  skills: string[];
  eligibility: string;
  deadline: string;
}

export const MOCK_OPPORTUNITIES: MockOpportunity[] = [
  {
    id: "junior-data-analyst",
    role: "Junior Data Analyst",
    company: "Northwind Analytics",
    location: "Hyderabad, Telangana",
    type: "Internship",
    skills: ["SQL", "Data Visualization", "Quantitative Aptitude"],
    eligibility: "Pre-final or final year, any engineering branch",
    deadline: "2026-11-30",
  },
  {
    id: "backend-intern",
    role: "Backend Engineering Intern",
    company: "Vellore Softworks",
    location: "Remote",
    type: "Internship",
    skills: ["API Design", "Backend Fundamentals", "Databases"],
    eligibility: "3rd year and above, CSE/IT/AI-ML",
    deadline: "2026-12-15",
  },
  {
    id: "sde-1",
    role: "Software Engineer I",
    company: "Deccan Systems",
    location: "Bengaluru, Karnataka",
    type: "Job",
    skills: ["Programming Fundamentals", "Data Structures", "Python"],
    eligibility: "Final year, all engineering branches",
    deadline: "2027-01-10",
  },
  {
    id: "alumni-referral",
    role: "Referral: Product Analyst",
    company: "Krishna FinTech",
    location: "Vijayawada, Andhra Pradesh",
    type: "Referral",
    skills: ["SQL", "Quantitative Aptitude", "Verbal Communication"],
    eligibility: "Open to all years — referral introduces you to the hiring team",
    deadline: "2026-11-05",
  },
  {
    id: "campus-datathon-open",
    role: "Open Datathon",
    company: "Capabilio Community",
    location: "Online",
    type: "Competition",
    skills: ["SQL", "Data Visualization", "Logical Reasoning"],
    eligibility: "Open to all students",
    deadline: "2026-10-25",
  },
];
