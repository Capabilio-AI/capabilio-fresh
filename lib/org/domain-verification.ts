/**
 * Automatic college verification without a manual queue. A college proves its domain when its first registrant signs up with an academic email
 * address; staff who later register on that same domain are activated at once, but only as faculty (principal, HOD and TPO still need an admin,
 * because students often hold addresses on the same domain).
 */
const ACADEMIC_SUFFIXES = ["ac.in", "edu.in", "res.in", "edu"] as const;

/** The domain after the @, lower-cased, or null when the address is malformed. */
export function emailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  const domain = at > 0 ? email.trim().toLowerCase().slice(at + 1) : "";
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) ? domain : null;
}

/** The college's own domain: "cse.mvrcet.ac.in" and "mvrcet.ac.in" both give "mvrcet.ac.in". Null unless it sits under an academic suffix. */
export function academicRegistrableDomain(email: string): string | null {
  const domain = emailDomain(email);
  if (!domain) return null;
  const suffix = ACADEMIC_SUFFIXES.find((s) => domain === s || domain.endsWith(`.${s}`));
  if (!suffix || domain === suffix) return null;
  const labels = domain.split(".");
  return labels.slice(-(suffix.split(".").length + 1)).join(".");
}

export interface AutoApprovalInput {
  email: string;
  role: string;
  orgType: "institution" | "company";
  /** true when the name matched a college already on the platform */
  matchedExisting: boolean;
  /** the matched (or new) institution's verified domain, if it has one */
  institutionVerifiedDomain: string | null;
}

export interface AutoApprovalDecision {
  /** record this as the institution's verified domain */
  verifyDomain: string | null;
  /** make the new membership active now */
  activate: boolean;
}

/** Pure. Colleges only: companies have no surface yet and stay manual. */
export function decideAutoApproval(input: AutoApprovalInput): AutoApprovalDecision {
  const none: AutoApprovalDecision = { verifyDomain: null, activate: false };
  if (input.orgType !== "institution") return none;
  const domain = academicRegistrableDomain(input.email);
  if (!domain) return none;
  if (!input.matchedExisting) return { verifyDomain: domain, activate: false }; // the founder is already active; the domain just becomes verified
  if (input.role === "faculty" && input.institutionVerifiedDomain === domain) return { verifyDomain: null, activate: true };
  return none;
}
