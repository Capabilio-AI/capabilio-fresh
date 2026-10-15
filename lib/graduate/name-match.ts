// Does the name on a resume belong to the account holder? Lenient about order, middle names, initials and run-together names
// ("Gopi Chand" vs "Gopichand"), strict about a different person: at least two real name parts must be found (one if the account has one).
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(mr|mrs|ms|miss|dr|prof|shri|smt|sri)\b\.?/g, " ").replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);

export function namesMatch(accountName: string, resumeName: string): boolean {
  const account = norm(accountName).filter((t) => t.length >= 2);
  const resume = norm(resumeName);
  if (account.length === 0 || resume.length === 0) return true; // nothing to compare: never block on missing data
  const joined = resume.join("");
  const found = account.filter((t) => (t.length >= 3 ? joined.includes(t) : resume.includes(t))).length;
  return found >= Math.min(2, account.length);
}
