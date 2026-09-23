// Static, code-owned catalog — replaces the old `branches` DB table.
// Typing a query (e.g. "AI") matches against name + keyword aliases so
// related options surface even when the user doesn't know the exact
// official name (e.g. "AI" -> "AI & Machine Learning", "AI & Data Science").
// Add new branches/aliases here; no migration needed.

export interface BranchCatalogEntry {
  name: string;
  keywords: string[];
}

export const BRANCH_CATALOG: BranchCatalogEntry[] = [
  { name: "Computer Science and Engineering (CSE)", keywords: ["cse", "computer science", "cs"] },
  { name: "Information Technology (IT)", keywords: ["it", "information technology"] },
  {
    name: "Artificial Intelligence and Machine Learning (AI/ML)",
    keywords: ["ai", "ml", "ai/ml", "artificial intelligence", "machine learning", "aiml"],
  },
  {
    name: "Artificial Intelligence and Data Science (AI & DS)",
    keywords: ["ai", "ai&ds", "ai & ds", "aids", "ai ds", "artificial intelligence", "data science"],
  },
  { name: "Data Science", keywords: ["ds", "data science", "data analytics"] },
  { name: "Computer Science and Business Systems (CSBS)", keywords: ["csbs", "business systems"] },
  { name: "Cyber Security", keywords: ["cyber", "cybersecurity", "security", "infosec"] },
  { name: "Robotics and Automation", keywords: ["robotics", "automation"] },
  { name: "Internet of Things (IoT)", keywords: ["iot", "internet of things"] },
  { name: "Computer Engineering", keywords: ["computer engineering", "comp engg"] },
  {
    name: "Electronics and Communication Engineering (ECE)",
    keywords: ["ece", "electronics", "communication"],
  },
  {
    name: "Electrical and Electronics Engineering (EEE)",
    keywords: ["eee", "electrical", "electronics and electrical"],
  },
  { name: "Electronics and Instrumentation Engineering (EIE)", keywords: ["eie", "instrumentation"] },
  { name: "Mechanical Engineering", keywords: ["mech", "mechanical"] },
  { name: "Mechatronics Engineering", keywords: ["mechatronics"] },
  { name: "Civil Engineering", keywords: ["civil"] },
  { name: "Chemical Engineering", keywords: ["chemical", "chem engg"] },
  { name: "Aerospace Engineering", keywords: ["aerospace", "aeronautical"] },
  { name: "Automobile Engineering", keywords: ["automobile", "automotive"] },
  { name: "Biotechnology Engineering", keywords: ["biotech", "biotechnology"] },
  { name: "Biomedical Engineering", keywords: ["biomedical"] },
  { name: "Metallurgical Engineering", keywords: ["metallurgy", "metallurgical"] },
  { name: "Mining Engineering", keywords: ["mining"] },
  { name: "Textile Engineering", keywords: ["textile"] },
  { name: "Petroleum Engineering", keywords: ["petroleum"] },
  { name: "Marine Engineering", keywords: ["marine"] },
  { name: "Agricultural Engineering", keywords: ["agriculture", "agricultural"] },
  { name: "Industrial and Production Engineering", keywords: ["industrial", "production"] },
  { name: "Architecture", keywords: ["architecture", "b.arch"] },

  { name: "MBBS (Medicine)", keywords: ["mbbs", "medicine", "medical"] },
  { name: "BDS (Dental Surgery)", keywords: ["bds", "dental"] },
  { name: "BAMS (Ayurvedic Medicine)", keywords: ["bams", "ayurveda", "ayurvedic"] },
  { name: "BHMS (Homeopathic Medicine)", keywords: ["bhms", "homeopathy", "homeopathic"] },
  { name: "BPT (Physiotherapy)", keywords: ["bpt", "physiotherapy"] },
  { name: "B.Sc Nursing", keywords: ["nursing"] },

  { name: "BBA (Business Administration)", keywords: ["bba", "business administration"] },
  { name: "B.Com (Commerce)", keywords: ["bcom", "b.com", "commerce"] },
  { name: "Business Analytics", keywords: ["business analytics"] },

  { name: "B.Sc Physics", keywords: ["physics"] },
  { name: "B.Sc Chemistry", keywords: ["chemistry"] },
  { name: "B.Sc Mathematics", keywords: ["maths", "mathematics"] },
  { name: "B.Sc Biology / Life Sciences", keywords: ["biology", "life sciences"] },
  { name: "B.Sc Computer Science", keywords: ["bsc cs", "computer science"] },
  { name: "BCA (Computer Applications)", keywords: ["bca", "computer applications"] },
  { name: "B.A. Economics", keywords: ["economics"] },
  { name: "B.A. English", keywords: ["english", "literature"] },
  { name: "B.A. Psychology", keywords: ["psychology"] },

  { name: "B.Pharm (Pharmacy)", keywords: ["b.pharm", "pharmacy", "pharma"] },
  { name: "D.Pharm (Diploma in Pharmacy)", keywords: ["d.pharm", "diploma pharmacy"] },

  { name: "BA LLB", keywords: ["ba llb", "law", "llb"] },
  { name: "BBA LLB", keywords: ["bba llb"] },
  { name: "LLB", keywords: ["llb", "law"] },
];

// Word-boundary matching only — a raw "includes anywhere" substring check
// makes short abbreviations like "cs" or "it" false-match unrelated words
// that merely end the same way (e.g. "cs" inside "economics", "statistics").
function wordsOf(text: string): string[] {
  return text.split(/[\s/&().,-]+/).filter(Boolean);
}

function matchScore(query: string, entry: BranchCatalogEntry): number {
  const nameLower = entry.name.toLowerCase();
  if (nameLower.startsWith(query)) return 3;
  if (wordsOf(nameLower).some((w) => w.startsWith(query))) return 2;
  for (const keyword of entry.keywords) {
    if (keyword === query) return 2.5;
    if (keyword.startsWith(query)) return 1.5;
    if (wordsOf(keyword).some((w) => w.startsWith(query))) return 1;
  }
  return 0;
}

export function searchBranches(query: string, limit = 8): BranchCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];

  const scored = BRANCH_CATALOG.map((entry) => ({ entry, score: matchScore(q, entry) })).filter(
    (r) => r.score > 0
  );

  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((r) => r.entry);
}
