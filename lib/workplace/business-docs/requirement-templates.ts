import type { BusinessDocsTemplate } from "./types";

// Requirement and gap-analysis tickets. The notes carry deliberate traps: an opinion that is not a requirement, a vague request with no number,
// a request said twice by different people, and two statements that cannot both be true.

const MEGHDOOT_RESCHEDULE: BusinessDocsTemplate = {
  id: "ba-docs-reschedule-stories", difficulty: "easy", minLevel: "fresher", areas: ["requirements"],
  title: "Turn the reschedule meeting notes into user stories",
  requester: { name: "Rekha Menon", title: "Customer Support Manager, Meghdoot Express" },
  scenario: "Hi, we had a quick meeting about letting customers reschedule a missed delivery. My notes are below, a bit messy. Can you turn them into user stories with acceptance criteria the developers can test? Not everything said in the room is a requirement.",
  skillTags: ["User stories", "Acceptance criteria", "Requirements"],
  content: {
    company: "Meghdoot Express",
    deliverable: "Write user stories (As a …, I want …, so that …) that cover every real requirement in the notes. Give each story the note IDs it covers and at least one Given / When / Then acceptance criterion that a tester could check.",
    sections: ["stories"],
    roles: ["Customer", "Support agent", "Last-mile operations", "Product owner"],
    notes: [
      { id: "N1", from: "Rekha Menon, Support Manager", text: "Customers who miss a delivery should be able to pick a new delivery date themselves from the tracking page." },
      { id: "N2", from: "Imran Sheikh, Last-mile Ops Lead", text: "A new date can only be within the next 5 working days, otherwise the parcel goes back to the sender." },
      { id: "N3", from: "Rekha Menon, Support Manager", text: "The customer should get a confirmation by SMS once the new date is saved." },
      { id: "N4", from: "Pallavi Rao, Product Owner", text: "The reschedule screen must be fast on mobile." },
      { id: "N5", from: "Imran Sheikh, Last-mile Ops Lead", text: "Honestly our drivers deserve a better app too, but that's a conversation for another day." },
    ],
  },
  key: {
    mustCover: [
      { id: "N1", keywords: ["date", "reschedul"] },
      { id: "N2", keywords: ["working day", "sender"] },
      { id: "N3", keywords: ["sms", "confirm"] },
      { id: "N4", keywords: ["load", "fast", "quick", "second", "screen"] },
    ],
    vague: ["N4"],
  },
  solution: {
    stories: [
      { id: "S1", covers: ["N1"], text: "As a customer who missed a delivery, I want to choose a new delivery date on the tracking page, so that I get my parcel when I am home.", criteria: ["Given a parcel with a missed delivery, when the customer opens the tracking page, then a Reschedule option lists the dates they can pick."] },
      { id: "S2", covers: ["N2"], text: "As a last-mile operations lead, I want new dates limited to the next 5 working days, so that parcels are not held at the hub for long.", criteria: ["Given a delivery missed on a Monday, when the customer picks a date, then only the next 5 working days can be selected.", "Given no new date is chosen within 5 working days, when the window ends, then the parcel is marked return to sender."] },
      { id: "S3", covers: ["N3"], text: "As a customer, I want an SMS confirmation after I reschedule, so that I know the new date is booked.", criteria: ["Given a customer saves a new date, when the save succeeds, then an SMS with the new date is sent within 2 minutes."] },
      { id: "S4", covers: ["N4"], text: "As a customer on my phone, I want the reschedule screen to load quickly, so that I can finish even on a weak connection.", criteria: ["Given a 4G connection, when the customer opens the reschedule screen, then it is usable within 2 seconds."] },
    ],
  },
};

const KAVERI_WARRANTY: BusinessDocsTemplate = {
  id: "ba-docs-warranty-backlog", difficulty: "medium", minLevel: "fresher", areas: ["requirements"],
  title: "Write the warranty-claim backlog and spot the conflicts",
  requester: { name: "Lavanya Krishnan", title: "Customer Experience Lead, Kaveri Appliance Care" },
  scenario: "Hello, five of us gave input on the online warranty-claim portal and I have pasted every statement below. Please write the stories with testable criteria, give every story a test case, and flag anything that is said twice or contradicts something else, so we can settle it before the sprint.",
  skillTags: ["User stories", "Traceability", "Conflicts"],
  content: {
    company: "Kaveri Appliance Care",
    deliverable: "Write user stories with Given / When / Then criteria for every real requirement, list a test case for every story (traceability), and flag every duplicate and every contradiction by the two note IDs involved. Do not build a story on both sides of a contradiction: it needs a decision first.",
    sections: ["stories", "issues", "tests"],
    roles: ["Customer", "Warranty desk", "Finance", "Service technician"],
    notes: [
      { id: "N1", from: "Lavanya Krishnan, CX Lead", text: "Customers should be able to raise a warranty claim online by entering the product serial number and uploading the invoice." },
      { id: "N2", from: "Arvind Shetty, Warranty Desk Supervisor", text: "Claims for products older than 24 months must be rejected automatically, with the reason shown to the customer." },
      { id: "N3", from: "Lavanya Krishnan, CX Lead", text: "The customer must be able to see the claim status at any time: submitted, approved, technician assigned or closed." },
      { id: "N4", from: "Nikhil Bansal, Finance Business Partner", text: "Any claim above ₹10,000 needs approval from finance before a technician is sent." },
      { id: "N5", from: "Arvind Shetty, Warranty Desk Supervisor", text: "The warranty desk can approve every claim on its own, whatever the amount, so customers are not kept waiting." },
      { id: "N6", from: "Lavanya Krishnan, CX Lead", text: "Uploading the invoice should be easy." },
      { id: "N7", from: "Meera Joshi, Service Head", text: "People need a way to log warranty claims on our website using their serial number and the purchase bill." },
    ],
  },
  key: {
    mustCover: [
      { id: "N1", keywords: ["claim", "serial"] },
      { id: "N2", keywords: ["24 month", "24-month", "older", "expired", "reject"] },
      { id: "N3", keywords: ["status"] },
      { id: "N6", keywords: ["upload", "invoice"] },
    ],
    vague: ["N6"],
    contradiction: ["N4", "N5"],
    duplicate: ["N1", "N7"],
  },
  solution: {
    stories: [
      { id: "S1", covers: ["N1", "N7"], text: "As a customer, I want to raise a warranty claim online with my serial number and invoice, so that I don't have to visit a branch.", criteria: ["Given a valid serial number and an attached invoice, when the customer submits the form, then a claim is created with status submitted."] },
      { id: "S2", covers: ["N2"], text: "As a warranty desk supervisor, I want claims on products older than 24 months rejected automatically, so that the desk only handles valid claims.", criteria: ["Given a product bought 25 months ago, when the claim is submitted, then it is rejected and the reason 'warranty expired' is shown."] },
      { id: "S3", covers: ["N3"], text: "As a customer, I want to see my claim status at any time, so that I don't need to call support.", criteria: ["Given a claim with a technician assigned, when the customer opens My Claims, then the status shows technician assigned."] },
      { id: "S4", covers: ["N6"], text: "As a customer, I want to upload my invoice from my phone, so that I don't need a scanner.", criteria: ["Given a JPG or PDF invoice up to 5 MB, when the customer uploads it, then it is attached to the claim within 10 seconds."] },
    ],
    issues: [{ kind: "contradiction", refs: ["N4", "N5"] }, { kind: "duplicate", refs: ["N1", "N7"] }],
    tests: [{ id: "T1", title: "Submit a claim with serial number and invoice", covers: ["S1"] }, { id: "T2", title: "Expired warranty is auto-rejected", covers: ["S2"] }, { id: "T3", title: "Status shown on My Claims", covers: ["S3"] }, { id: "T4", title: "Invoice upload limits", covers: ["S4"] }],
  },
};

const ANNAPURNA_INVOICES: BusinessDocsTemplate = {
  id: "ba-docs-invoice-gaps", difficulty: "easy", minLevel: "fresher", areas: ["gap-analysis"],
  title: "Where does our invoice process fall short?",
  requester: { name: "Vikas Malhotra", title: "CFO, Annapurna Kitchens" },
  scenario: "Hi, our vendors are unhappy with how we pay them. Below is how invoices are handled today, and what finance and procurement want. Tell me where today's process falls short, and only there: I don't want to fix what already works.",
  skillTags: ["Gap analysis", "As-is / to-be", "Process"],
  content: {
    company: "Annapurna Kitchens",
    deliverable: "Compare the current process with each requirement in the notes. Add one gap row for every requirement the current process does not meet: the current state, the target state, the action to close it and the owner (from the team list).",
    sections: ["gaps"],
    roles: ["Kitchen manager", "Accounts", "Procurement", "Vendor"],
    asIs: [
      "Vendors email scanned paper invoices to the kitchen manager.",
      "The kitchen manager forwards all invoices to accounts at month end.",
      "Accounts checks each invoice against its purchase order.",
      "Accounts pays every invoice in one batch on the 5th of the next month.",
    ],
    notes: [
      { id: "N1", from: "Vikas Malhotra, CFO", text: "Every invoice must be matched against its purchase order before it is paid." },
      { id: "N2", from: "Vikas Malhotra, CFO", text: "Vendors must be paid within 15 days of sending a valid invoice." },
      { id: "N3", from: "Shalini Arora, Procurement Lead", text: "Vendors should submit invoices through the vendor portal, not by email." },
      { id: "N4", from: "Shalini Arora, Procurement Lead", text: "Procurement must approve any invoice above ₹50,000 before accounts pays it." },
    ],
  },
  key: { mustCover: [], vague: [], gaps: ["N2", "N3", "N4"], met: ["N1"] },
  solution: {
    gaps: [
      { note: "N2", current: "All invoices are paid in one monthly batch, up to 35 days later.", target: "Each valid invoice is paid within 15 days.", action: "Run a weekly payment cycle.", owner: "Accounts" },
      { note: "N3", current: "Invoices arrive as scans by email to the kitchen manager.", target: "Vendors upload invoices to the vendor portal.", action: "Onboard vendors to the portal and stop accepting email invoices.", owner: "Procurement" },
      { note: "N4", current: "Accounts pays large invoices with no procurement approval.", target: "Invoices above ₹50,000 are approved by procurement before payment.", action: "Add an approval step for invoices above ₹50,000.", owner: "Procurement" },
    ],
  },
};

const TARANG_SIM: BusinessDocsTemplate = {
  id: "ba-docs-sim-kyc-gaps", difficulty: "medium", minLevel: "fresher", areas: ["gap-analysis"],
  title: "SIM activation: compliance gaps and a conflict to settle",
  requester: { name: "Ritu Sabharwal", title: "Compliance Officer, Tarang Telecom" },
  scenario: "Hello, an audit is coming. Retail and compliance both sent me what they need from SIM activation and I am not sure they agree. Please compare it with how stores work today, list the real gaps, and flag any statements that contradict each other.",
  skillTags: ["Gap analysis", "Compliance", "Conflicts"],
  content: {
    company: "Tarang Telecom",
    deliverable: "Add a gap row for every requirement the current process does not meet (current state, target state, action, owner from the team list), and flag any two notes that contradict each other.",
    sections: ["gaps", "issues"],
    roles: ["Store executive", "Back office", "Compliance", "Retail operations"],
    asIs: [
      "The store executive collects photocopies of the customer's ID and address proof.",
      "The store executive activates the SIM straight after payment.",
      "The back office verifies the photocopies within 3 days of activation.",
      "The customer gets a welcome SMS once the SIM is live.",
    ],
    notes: [
      { id: "N1", from: "Ritu Sabharwal, Compliance Officer", text: "A SIM must not be activated until the customer's identity has been verified." },
      { id: "N2", from: "Ritu Sabharwal, Compliance Officer", text: "Identity must be verified through digital e-KYC in the store, not from photocopies." },
      { id: "N3", from: "Karan Ahuja, Retail Operations Head", text: "Customers must get a welcome SMS once the SIM is live." },
      { id: "N4", from: "Karan Ahuja, Retail Operations Head", text: "To avoid losing sales, store executives must be able to activate the SIM straight after payment, before any checks." },
    ],
  },
  key: { mustCover: [], vague: [], gaps: ["N1", "N2"], met: ["N3", "N4"], contradiction: ["N1", "N4"] },
  solution: {
    gaps: [
      { note: "N1", current: "The SIM is activated before the documents are verified.", target: "The SIM is activated only after identity is verified.", action: "Block activation in the store app until verification passes.", owner: "Retail operations" },
      { note: "N2", current: "Photocopies are checked by the back office days later.", target: "Identity is verified by digital e-KYC in the store.", action: "Roll out e-KYC devices to every store.", owner: "Compliance" },
    ],
    issues: [{ kind: "contradiction", refs: ["N1", "N4"] }],
  },
};

export const REQUIREMENT_TEMPLATES: BusinessDocsTemplate[] = [MEGHDOOT_RESCHEDULE, KAVERI_WARRANTY, ANNAPURNA_INVOICES, TARANG_SIM];
