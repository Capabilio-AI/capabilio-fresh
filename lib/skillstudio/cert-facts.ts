// What the certification catalog does not store yet: typical cost, exam length, prerequisites and what passing validates.
// Keyed by the provider's own page, so a catalog row can be renamed without losing it. A value stored on the catalog row itself
// always wins over this file (see loadCertifications), so editors can correct any of these in the database without a deploy.
// Prices are the providers' usual public list prices in USD and change by country and over time: the UI says so next to every figure.

export interface CertFacts {
  cost: string;
  exam: string;
  prerequisites: string;
  validates: string[];
}

const FACTS: { match: string; facts: CertFacts }[] = [
  { match: "cloud.google.com/learn/certification/machine-learning-engineer", facts: { cost: "About $200 USD", exam: "2 hours, multiple choice", prerequisites: "None required. Google suggests 3+ years of industry experience, including 1+ year designing ML solutions on Google Cloud.", validates: ["Design, build and productionise ML models on Google Cloud", "Frame business problems as ML problems and pick the right approach", "Automate pipelines, monitor models and handle drift in production"] } },
  { match: "azure-data-scientist", facts: { cost: "About $165 USD", exam: "DP-100 · about 100 minutes", prerequisites: "None required. Python and basic ML knowledge are expected.", validates: ["Train, evaluate and tune ML models on Azure Machine Learning", "Run experiments and manage data and compute", "Deploy models as endpoints and keep them monitored"] } },
  { match: "azure-ai-fundamentals", facts: { cost: "About $99 USD", exam: "AI-900 · about 45 minutes", prerequisites: "None. A beginner-friendly entry point.", validates: ["Core AI and machine learning concepts", "Computer vision, language and generative AI workloads on Azure", "Responsible AI principles"] } },
  { match: "azure-data-fundamentals", facts: { cost: "About $99 USD", exam: "DP-900 · about 45 minutes", prerequisites: "None. A beginner-friendly entry point.", validates: ["Relational and non-relational data concepts", "Data workloads and analytics on Azure", "The roles and services around data"] } },
  { match: "certifications/data-analyst-associate", facts: { cost: "About $165 USD", exam: "PL-300 · about 100 minutes", prerequisites: "None required. Hands-on Power BI experience helps.", validates: ["Prepare and model data for analysis", "Build reports and dashboards in Power BI", "Deploy and maintain analytics assets"] } },
  { match: "certified-cloud-practitioner", facts: { cost: "About $100 USD", exam: "CLF-C02 · 90 minutes, 65 questions", prerequisites: "None. A beginner-friendly entry point.", validates: ["Core AWS cloud concepts, services and pricing", "Security and shared-responsibility basics", "Which AWS service fits which need"] } },
  { match: "certified-ai-practitioner", facts: { cost: "About $100 USD", exam: "AIF-C01 · 90 minutes", prerequisites: "None. A beginner-friendly entry point.", validates: ["AI, ML and generative AI fundamentals", "Using AWS AI services and foundation models", "Responsible AI and security practices"] } },
  { match: "certified-developer-associate", facts: { cost: "About $150 USD", exam: "DVA-C02 · about 130 minutes", prerequisites: "None required. Around a year of hands-on AWS development is recommended.", validates: ["Develop and deploy applications on AWS", "Use SDKs, serverless and CI/CD for AWS apps", "Debug, secure and optimise AWS applications"] } },
  { match: "certifications/github-foundations", facts: { cost: "About $99 USD", exam: "GitHub Foundations · about 90 minutes", prerequisites: "None. A beginner-friendly entry point.", validates: ["Git and GitHub collaboration workflows", "Pull requests, issues and project management", "Basic repository security and GitHub Actions"] } },
  { match: "grow.google/certificates/data-analytics", facts: { cost: "Coursera subscription, about $49 USD a month; financial aid is available", exam: "Self-paced courses, usually 3 to 6 months", prerequisites: "None. Built for beginners.", validates: ["The full analyst workflow: ask, prepare, process, analyse, share, act", "Spreadsheets, SQL and Tableau basics", "A portfolio case study"] } },
  { match: "istqb", facts: { cost: "Varies by country and exam body (roughly $150 to $250 USD)", exam: "CTFL · about 60 minutes", prerequisites: "None.", validates: ["Software testing fundamentals and terminology", "Test design techniques and test management", "Where testing fits in the development lifecycle"] } },
];

export function factsFor(url: string | null): CertFacts | null {
  if (!url) return null;
  const u = url.toLowerCase();
  return FACTS.find((f) => u.includes(f.match))?.facts ?? null;
}
