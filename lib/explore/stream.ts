import { clusterKeyForBranch, IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";

/** A student's stream, coarse enough to suggest roles from. Anything unrecognised is "other". */
export type Stream = "it" | "ece" | "eee" | "mech" | "civil" | "other";

export function streamOf(branch: string | null): Stream {
  if (!branch?.trim()) return "other";
  if (clusterKeyForBranch(branch) === IT_CLUSTER_SCOPE_KEY) return "it";
  const b = ` ${branch.toLowerCase()} `;
  if (/electrical|\beee\b/.test(b)) return "eee"; // "Electrical and Electronics" is EEE, so it is checked before ECE
  if (/electronics|communication|\bece\b|\betm\b/.test(b)) return "ece";
  if (/mechanical|automobile|mechatronics|\bmech\b/.test(b)) return "mech";
  if (/civil|construction|structural/.test(b)) return "civil";
  return "other";
}

export interface StreamSuggestion {
  label: string;
  /** roles already in the catalogue, in the order to show them; a name not in the catalogue is skipped */
  roles: string[];
  /** common roles for the stream that are not in the catalogue yet: Capabilio builds the skill list when the student picks one */
  extra: { name: string; blurb: string }[];
}

export const STREAM_SUGGESTIONS: Record<Stream, StreamSuggestion> = {
  it: { label: "CSE / IT / AI", roles: ["Software Engineer", "Full Stack Developer", "Data Analyst", "AI/ML Engineer", "Cloud Engineer", "Cybersecurity Analyst", "Software Test Automation Engineer", "Data Engineer"], extra: [] },
  ece: {
    label: "Electronics & Communication",
    roles: ["Embedded Systems Engineer", "IoT Firmware Engineer", "PLC Automation Engineer", "Software Test Automation Engineer", "Software Engineer", "Data Analyst"],
    extra: [
      { name: "VLSI Design Engineer", blurb: "Designs and verifies the chips inside phones and laptops." },
      { name: "Network Engineer", blurb: "Builds and runs the networks that connect offices and telecom services." },
      { name: "RF Engineer", blurb: "Plans and tunes mobile and wireless signal systems." },
    ],
  },
  eee: {
    label: "Electrical & Electronics",
    roles: ["PLC Automation Engineer", "Embedded Systems Engineer", "IoT Firmware Engineer", "Automotive Engineer", "Software Test Automation Engineer"],
    extra: [
      { name: "Power Systems Engineer", blurb: "Works on how electricity is generated, moved and protected." },
      { name: "Electrical Design Engineer", blurb: "Designs wiring, panels and electrical layouts for buildings and plants." },
      { name: "Electric Vehicle Engineer", blurb: "Works on batteries, motors and chargers for electric vehicles." },
    ],
  },
  mech: {
    label: "Mechanical",
    roles: ["Mechanical Design Engineer", "Automotive Engineer", "PLC Automation Engineer", "Product Designer", "Business Analyst"],
    extra: [
      { name: "Manufacturing Engineer", blurb: "Makes factory processes faster, safer and cheaper." },
      { name: "Quality Engineer", blurb: "Checks that parts and products meet the standard." },
      { name: "CAD/CAE Engineer", blurb: "Models and tests designs on the computer before they are built." },
    ],
  },
  civil: {
    label: "Civil",
    roles: ["Site Engineer", "Business Analyst", "Product Manager"],
    extra: [
      { name: "Structural Design Engineer", blurb: "Designs beams, slabs and foundations that stand safely." },
      { name: "Quantity Surveyor", blurb: "Estimates materials and costs, and checks bills on a project." },
      { name: "Construction Planning Engineer", blurb: "Plans the schedule so a project finishes on time." },
      { name: "Highway Engineer", blurb: "Designs and builds roads and bridges." },
    ],
  },
  other: {
    label: "any stream",
    roles: ["Data Analyst", "Business Analyst", "Product Manager", "Software Engineer", "Product Designer"],
    extra: [],
  },
};
