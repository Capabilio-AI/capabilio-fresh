/**
 * What goes in "Download my data": the rows a person created or that describe them, one entry per table.
 * Deliberately left out: integration tokens (github_connections), rate-limit and AI-call logs, and other people's messages.
 */
export const EXPORT_SOURCES: ReadonlyArray<{ table: string; column: string }> = [
  { table: "profiles", column: "id" },
  { table: "student_onboarding", column: "student_id" },
  { table: "student_journeys", column: "user_id" },
  { table: "student_career_intent", column: "student_id" },
  { table: "career_interest_target", column: "user_id" },
  { table: "interests", column: "user_id" },
  { table: "guide_paths", column: "user_id" },
  { table: "vault_items", column: "user_id" },
  { table: "graduate_resumes", column: "user_id" },
  { table: "capabilities", column: "user_id" },
  { table: "capability_history", column: "user_id" },
  { table: "student_skill_scores", column: "student_id" },
  { table: "student_skill_evidence", column: "student_id" },
  { table: "evidence", column: "user_id" },
  { table: "assess_sessions", column: "student_id" },
  { table: "assessment_attempts", column: "user_id" },
  { table: "assessment_responses", column: "user_id" },
  { table: "assessment_feedback", column: "student_id" },
  { table: "arena_ratings", column: "user_id" },
  { table: "arena_challenge_attempts", column: "user_id" },
  { table: "roadmaps", column: "student_id" },
  { table: "roadmap_node_state", column: "student_id" },
  { table: "proof_of_work", column: "student_id" },
  { table: "projects", column: "created_by" },
  { table: "project_contributions", column: "user_id" },
  { table: "github_repositories", column: "user_id" },
  { table: "applications", column: "user_id" },
  { table: "institution_memberships", column: "user_id" },
  { table: "posts", column: "user_id" },
  { table: "post_comments", column: "user_id" },
  { table: "community_posts", column: "user_id" },
  { table: "dm_messages", column: "sender_id" },
  { table: "stories", column: "user_id" },
];

/** One table never returns more than this; a table that hits it is flagged so the file is never silently partial. */
export const ROWS_PER_TABLE = 5000;

interface QueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface ExportClient {
  from: (table: string) => { select: (cols: string) => { eq: (col: string, value: string) => { limit: (n: number) => PromiseLike<QueryResult> } } };
}

export interface AccountExport {
  exportedAt: string;
  userId: string;
  email: string | null;
  tables: Record<string, unknown[]>;
  /** Tables that could not be read in full. Empty when the file is complete. */
  incomplete: { table: string; reason: string }[];
}

export async function buildAccountExport(client: ExportClient, user: { id: string; email: string | null }, now: Date): Promise<AccountExport> {
  const results = await Promise.all(
    EXPORT_SOURCES.map(async ({ table, column }) => {
      const { data, error } = await client.from(table).select("*").eq(column, user.id).limit(ROWS_PER_TABLE);
      return { table, rows: data ?? [], error };
    })
  );

  const tables: Record<string, unknown[]> = {};
  const incomplete: AccountExport["incomplete"] = [];
  for (const { table, rows, error } of results) {
    if (error) incomplete.push({ table, reason: "could not be read" });
    else if (rows.length >= ROWS_PER_TABLE) incomplete.push({ table, reason: `truncated at ${ROWS_PER_TABLE} rows` });
    if (rows.length > 0) tables[table] = rows;
  }
  return { exportedAt: now.toISOString(), userId: user.id, email: user.email, tables, incomplete };
}
