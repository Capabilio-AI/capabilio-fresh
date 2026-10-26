import type { BusinessDocsTemplate } from "./types";

// Process-mapping tickets: the notes describe who does what, in the stakeholders' own words. The student draws the map
// (and, for the harder one, the RACI). Checks are structural, plus "the steps the notes describe are on the map with the right owner".

const SAHYADRI_LOAN: BusinessDocsTemplate = {
  id: "ba-docs-loan-process-map", difficulty: "easy", minLevel: "fresher", areas: ["process-mapping"],
  title: "Map how a loan application moves today",
  requester: { name: "Smita Kulkarni", title: "Branch Manager, Sahyadri Microfinance" },
  scenario: "Hi, head office wants the as-is map of our loan application process before they change anything. I asked the team how it works and wrote down what each person said. Please draw it as a process map with an owner on every step.",
  skillTags: ["Process mapping", "As-is", "Decisions"],
  content: {
    company: "Sahyadri Microfinance",
    deliverable: "Build the as-is process map: one start, the steps in order, each owned by someone from the team list, a decision with labelled branches where the notes describe one, and an end. The branches of a decision must come back together.",
    sections: ["process"],
    roles: ["Field officer", "Credit team", "Accounts team", "Branch manager"],
    notes: [
      { id: "N1", from: "Ganesh Patil, Field Officer", text: "I collect the application and KYC documents at the borrower's home and upload them at the branch." },
      { id: "N2", from: "Smita Kulkarni, Branch Manager", text: "The credit team checks the documents and pulls the credit score." },
      { id: "N3", from: "Rahul Deshmukh, Credit Analyst", text: "If the score is 650 or more we approve. Below that we reject, and the field officer tells the borrower." },
      { id: "N4", from: "Smita Kulkarni, Branch Manager", text: "Approved loans are paid out by the accounts team straight into the borrower's bank account." },
      { id: "N5", from: "Smita Kulkarni, Branch Manager", text: "Whatever the outcome, I close the application in the system at the end." },
    ],
  },
  key: {
    mustCover: [], vague: [],
    requiredSteps: [
      { type: "task", keywords: ["collect", "kyc", "application"], owners: ["Field officer"] },
      { type: "task", keywords: ["credit", "score", "check"], owners: ["Credit team"] },
      { type: "decision", keywords: ["650", "score", "approve"], owners: ["Credit team"] },
      { type: "task", keywords: ["disburs", "pay", "bank"], owners: ["Accounts team"] },
      { type: "task", keywords: ["tell", "inform", "notify", "reject"], owners: ["Field officer"] },
      { type: "task", keywords: ["close"], owners: ["Branch manager"] },
    ],
  },
  solution: {
    process: [
      { id: "start", label: "Borrower applies", type: "start", owner: "Field officer", next: [{ to: "collect" }] },
      { id: "collect", label: "Collect application and KYC documents", type: "task", owner: "Field officer", next: [{ to: "check" }] },
      { id: "check", label: "Check documents and pull credit score", type: "task", owner: "Credit team", next: [{ to: "decide" }] },
      { id: "decide", label: "Score 650 or more?", type: "decision", owner: "Credit team", next: [{ to: "pay", label: "Yes" }, { to: "tell", label: "No" }] },
      { id: "pay", label: "Disburse loan to bank account", type: "task", owner: "Accounts team", next: [{ to: "close" }] },
      { id: "tell", label: "Tell borrower the loan is rejected", type: "task", owner: "Field officer", next: [{ to: "close" }] },
      { id: "close", label: "Close application in the system", type: "task", owner: "Branch manager", next: [{ to: "end" }] },
      { id: "end", label: "Application closed", type: "end", owner: "", next: [] },
    ],
  },
};

const ROLES = ["Support agent", "Support manager", "Hub operations", "Claims team", "Finance controller"];

const MEGHDOOT_DAMAGE: BusinessDocsTemplate = {
  id: "ba-docs-damage-claim-raci", difficulty: "medium", minLevel: "fresher", areas: ["process-mapping"],
  title: "Damaged-parcel claims: map the flow and who decides",
  requester: { name: "Joseph D'Souza", title: "Claims Head, Meghdoot Express" },
  scenario: "Hello, damaged-parcel claims bounce between four teams and nobody is sure who owns the final call. Please map the process from the notes and fill in a RACI for the key tasks, so we can agree on it at Thursday's ops meeting.",
  skillTags: ["Process mapping", "RACI", "Decision rights"],
  content: {
    company: "Meghdoot Express",
    deliverable: "Build the process map (one start, owned steps, labelled decision branches that rejoin, an end) and fill the RACI matrix: each task needs at least one Responsible and exactly one Accountable, as the notes say.",
    sections: ["process", "raci"],
    roles: ROLES,
    raciTasks: [
      { id: "log", label: "Log the damage claim" },
      { id: "inspect", label: "Inspect the parcel" },
      { id: "approve", label: "Approve a settlement above ₹5,000" },
      { id: "settle", label: "Pay the settlement" },
    ],
    notes: [
      { id: "N1", from: "Rekha Menon, Support Manager", text: "The support agent logs the damage claim with the customer's photos. As support manager, I am accountable for every claim being logged." },
      { id: "N2", from: "Imran Sheikh, Last-mile Ops Lead", text: "Hub operations inspects the parcel within 48 hours and records whether the damage is confirmed." },
      { id: "N3", from: "Joseph D'Souza, Claims Head", text: "If the damage is not confirmed, the support agent explains the decision to the customer." },
      { id: "N4", from: "Joseph D'Souza, Claims Head", text: "If it is confirmed, my team checks the amount. Anything above ₹5,000 needs the finance controller's approval, and the finance controller alone answers for that approval." },
      { id: "N5", from: "Joseph D'Souza, Claims Head", text: "The finance controller releases the payment, but I answer for every rupee we settle, so the claims team is accountable for it." },
      { id: "N6", from: "Rekha Menon, Support Manager", text: "In every case the support agent closes the ticket at the end." },
    ],
  },
  key: {
    mustCover: [], vague: [],
    requiredSteps: [
      { type: "task", keywords: ["log", "claim", "photo"], owners: ["Support agent"] },
      { type: "task", keywords: ["inspect"], owners: ["Hub operations"] },
      { type: "decision", keywords: ["confirm", "damage"], owners: ["Hub operations", "Claims team"] },
      { type: "decision", keywords: ["5,000", "5000", "amount"], owners: ["Claims team"] },
      { type: "task", keywords: ["approv", "sign"], owners: ["Finance controller"] },
      { type: "task", keywords: ["pay", "settle", "release"], owners: ["Finance controller"] },
      { type: "task", keywords: ["explain", "inform", "tell"], owners: ["Support agent"] },
      { type: "task", keywords: ["close"], owners: ["Support agent"] },
    ],
    raciExpect: [
      { task: "log", role: "Support agent", letter: "R" },
      { task: "inspect", role: "Hub operations", letter: "R" },
      { task: "approve", role: "Finance controller", letter: "A" },
      { task: "settle", role: "Claims team", letter: "A" },
    ],
  },
  solution: {
    process: [
      { id: "start", label: "Customer reports damage", type: "start", owner: "Support agent", next: [{ to: "log" }] },
      { id: "log", label: "Log damage claim with photos", type: "task", owner: "Support agent", next: [{ to: "inspect" }] },
      { id: "inspect", label: "Inspect the parcel", type: "task", owner: "Hub operations", next: [{ to: "confirmed" }] },
      { id: "confirmed", label: "Damage confirmed?", type: "decision", owner: "Hub operations", next: [{ to: "amount", label: "Yes" }, { to: "explain", label: "No" }] },
      { id: "amount", label: "Amount above ₹5,000?", type: "decision", owner: "Claims team", next: [{ to: "approve", label: "Yes" }, { to: "pay", label: "No" }] },
      { id: "approve", label: "Approve the settlement", type: "task", owner: "Finance controller", next: [{ to: "pay" }] },
      { id: "pay", label: "Pay the settlement", type: "task", owner: "Finance controller", next: [{ to: "close" }] },
      { id: "explain", label: "Explain the decision to the customer", type: "task", owner: "Support agent", next: [{ to: "close" }] },
      { id: "close", label: "Close the ticket", type: "task", owner: "Support agent", next: [{ to: "end" }] },
      { id: "end", label: "Claim closed", type: "end", owner: "", next: [] },
    ],
    raci: {
      log: { "Support agent": "R", "Support manager": "A", "Hub operations": "I", "Claims team": "I", "Finance controller": "" },
      inspect: { "Support agent": "I", "Support manager": "", "Hub operations": "R", "Claims team": "A", "Finance controller": "" },
      approve: { "Support agent": "", "Support manager": "", "Hub operations": "", "Claims team": "R", "Finance controller": "A" },
      settle: { "Support agent": "I", "Support manager": "", "Hub operations": "", "Claims team": "A", "Finance controller": "R" },
    },
  },
};

export const PROCESS_TEMPLATES: BusinessDocsTemplate[] = [SAHYADRI_LOAN, MEGHDOOT_DAMAGE];
