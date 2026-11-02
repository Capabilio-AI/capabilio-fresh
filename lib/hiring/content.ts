// The fixed copy on /careers. Roles themselves live in the database and are posted from /admin/careers; only this wording is code.

export const HIRING_STEPS = [
  {
    title: "Send proof",
    body: "A link to something you built, solved or shipped, and a few lines on what you did and what you would change. A resume is optional.",
  },
  {
    title: "We read it",
    body: "A person on the team opens your work and reads it. Nothing is filtered on keywords or on where you studied.",
  },
  {
    title: "Do a real brief",
    body: "A small, real problem from the role, written down before you start so you know what we are looking for.",
  },
  {
    title: "Talk it through",
    body: "We go through your work together and decide. Either way, you hear the answer from us.",
  },
] as const;

// Taken from Capabilio's own product principles (PRODUCT.md): the way the product is built is the way the team works.
export const BELIEFS = [
  {
    title: "Evidence over decoration",
    body: "We would rather show a true number than a flattering one. If the data does not support it, it does not ship.",
  },
  {
    title: "Honest absence",
    body: "“Not assessed” is a real answer. We say what we do not know instead of filling the gap with a guess.",
  },
  {
    title: "One truth, many readers",
    body: "A student, an advisor and an organisation read the same record. Nobody gets a different story.",
  },
  {
    title: "The next step is always visible",
    body: "Every screen answers “what should I do now?”. The same goes for how we work with each other.",
  },
] as const;

export const SAMPLE_BRIEF = {
  role: "Sample role",
  fields: [
    { label: "Something you built, solved or shipped", value: "github.com/your-name/project" },
    { label: "What did you do, and what would you change?", value: "I built the scheduler. The first version was too slow with large rooms, so I…" },
  ],
} as const;

/** Where candidates can send a profile and portfolio instead of using the form. */
export const CAREERS_EMAIL = "careers@capabilio.online";

/** Pure. A mailto link with the subject filled in. */
export function mailtoFor(subject: string): string {
  return `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export const MISSION = {
  title: "We are building the career operating system where proof beats resume.",
  body: "Capabilio turns what a person has actually demonstrated into one record, a Skill Passport, that students and colleges can trust. Every role here helps make that record more true, more useful and easier to reach.",
  serves: [
    { who: "Students and recent graduates", note: "Assessments, a career map and a live rating built from real work." },
    { who: "Colleges, universities and companies", note: "Cohorts, calendars and one honest view of readiness." },
    { who: "Working professionals and executives", note: "Coming soon." },
  ],
} as const;

// What each team does. A team without an entry here is still listed, just without a line.
export const TEAM_BLURBS: Record<string, string> = {
  Engineering: "Builds the web app and the rating engine, and next the Android and iOS apps.",
  Content: "Writes and checks the challenges and questions students are measured on.",
  Partnerships: "Brings colleges and universities onto Capabilio and keeps their cohorts running.",
  Growth: "Helps students and colleges find Capabilio, and tells us what makes them stay.",
};

export const FAQ = [
  { q: "Do I need a resume?", a: "No. A link to something you built, solved or shipped matters more. A resume is optional." },
  { q: "How do I apply?", a: `Use the form on a role page, or email your profile and portfolio to ${CAREERS_EMAIL}. Either way, include a link to your work and a few lines on what you did.` },
  { q: "What happens after I apply?", a: "A person on the team opens your work and reads it. If it fits, we give you a small real brief, then talk it through together." },
  { q: "Are the internships paid?", a: "No. The internships are unpaid, and they are hybrid. Each one says so on its page." },
  { q: "What if none of the roles fit me?", a: "Introduce yourself with the form at the bottom of this page, or email us. We will write when something lines up." },
  { q: "Can I apply to more than one role?", a: "Yes. Send one application for each, and tell us which one you would pick first." },
] as const;

// Shown on every role page. These are expectations drawn from how the product is built, not perks.
export const WORK_CULTURE = {
  intro: "Capabilio is a small team building something people use to make real decisions about their careers. That shapes how we work.",
  asks: [
    { title: "Show evidence", body: "We back claims with something real: a test, a number, a link, a user. When we do not know, we say so." },
    { title: "Be honest about what is not working", body: "Bad news early is useful. A bug, a wrong question or a missed deadline is easier to fix when we hear about it." },
    { title: "Keep the next step clear", body: "Every task ends with a clear next step and an owner, so nothing sits waiting." },
    { title: "Own your work", body: "You are trusted with real problems and expected to see them through, and to ask for help early." },
  ],
  gives: [
    "Clear scope for each task",
    "Direct feedback on your work, including what is not working",
    "A direct line to the founder",
    "An answer from us either way after your interview",
  ],
  hybrid: "This role is hybrid. We will agree the details of when and where we work together before you accept.",
} as const;
