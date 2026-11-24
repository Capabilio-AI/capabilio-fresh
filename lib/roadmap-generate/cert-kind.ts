// A certification that tests you (a proctored exam or an assessed credential from a vendor or professional body) is worth showing a
// recruiter. A course-completion certificate only says you watched the course. Pure, so generation and display agree.
const COURSE_PLATFORMS = /coursera|udemy|edx|udacity|skillshare|nptel|swayam|linkedin\.com\/learning|linkedin learning|simplilearn|great ?learning|upgrad|pluralsight|codecademy|datacamp|futurelearn|alison/i;

export type CertKind = "exam" | "course";

export function certKind(c: { provider?: string | null; url?: string | null }): CertKind {
  return COURSE_PLATFORMS.test(`${c.provider ?? ""} ${c.url ?? ""}`) ? "course" : "exam";
}
