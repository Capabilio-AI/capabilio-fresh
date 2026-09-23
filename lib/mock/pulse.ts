// DEV MOCK DATA — Pulse's follow graph, communities, and mentor directory
// have no backend tables yet. Isolated here; see Database Migrations note
// in the final report for what a real version needs (follows, communities,
// community_members).

export const MOCK_TRENDING_TOPICS = ["#DataAnalytics", "#SQL", "#Internships", "#Projects", "#Placements"];

export interface MockPerson {
  id: string;
  name: string;
  role: string;
  kind: "Mentor" | "Student" | "Industry";
}

export const MOCK_PEOPLE_TO_FOLLOW: MockPerson[] = [
  { id: "p1", name: "Priya Ramesh", role: "SDE Mentor · ex-Flipkart", kind: "Mentor" },
  { id: "p2", name: "Arjun Nair", role: "3rd Year, CSE", kind: "Student" },
  { id: "p3", name: "Divya Shah", role: "Data Analyst, Infosys", kind: "Industry" },
];
