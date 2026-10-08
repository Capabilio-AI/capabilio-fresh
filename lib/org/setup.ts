export interface SetupInput {
  profilePublic: boolean;
  hasBio: boolean;
  hasWebsite: boolean;
  publishedPosts: number;
  materials: number;
  projects: number;
  drives: number;
  students: number;
}

export interface SetupStep {
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

/**
 * Pure. Every step maps to something that is genuinely checkable in the database — the same idea as the
 * reference's trust checklist, but nothing is a placeholder and nothing implies a review that hasn't happened.
 */
export function buildSetupChecklist(i: SetupInput): SetupStep[] {
  return [
    { label: "Write your college's About", hint: "Two or three lines students and visitors read first.", done: i.hasBio, href: "/org/college?edit=1" },
    { label: "Add your website", hint: "Lets visitors verify who you are.", done: i.hasWebsite, href: "/org/college?edit=1" },
    { label: "Publish your college page", hint: "Public pages are off until you turn them on.", done: i.profilePublic, href: "/org/college?edit=1" },
    { label: "Get students signed up", hint: "Students join by picking your college's exact name.", done: i.students > 0, href: "/org/students" },
    { label: "Share a course material or project", hint: "Gives students something to do on day one.", done: i.materials + i.projects > 0, href: i.materials > 0 ? "/org/projects" : "/org/materials" },
    { label: "Post an event or announcement", hint: "Your first update appears on the college page.", done: i.publishedPosts > 0, href: "/org/college" },
    { label: "Post a placement drive", hint: "Final-year students see it in Launchpad.", done: i.drives > 0, href: "/org/placements" },
  ];
}
