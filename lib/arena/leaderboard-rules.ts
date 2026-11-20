/** Pure. Each student's rating on their MAIN role, the same figure the dashboard and portfolio show; a student with no rating on it yet is left out. */
export function mainRoleRatings(ledger: readonly { student_id: string; career_id: string; rating: number }[], primaryByStudent: ReadonlyMap<string, string>): { user_id: string; rating: number }[] {
  return ledger.flatMap((r) => (primaryByStudent.get(r.student_id) === r.career_id ? [{ user_id: r.student_id, rating: Math.round(r.rating) }] : []));
}
