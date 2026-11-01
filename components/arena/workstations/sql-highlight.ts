export type SqlTokenKind = "keyword" | "string" | "number" | "comment" | "plain";
export interface SqlToken {
  kind: SqlTokenKind;
  text: string;
}

const KEYWORDS = new Set(
  "select from where group by order having limit offset join inner left right full outer cross on as and or not in is null like between exists case when then else end distinct union all with over partition insert into values update set delete create table alter add drop index primary key foreign references default asc desc count sum avg min max round coalesce cast strftime date substr upper lower trim length".split(" ")
);

const PATTERN = /(--[^\n]*)|('(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

/** Splits SQL into coloured runs for the editor overlay. Concatenating every token's text gives back the input exactly, so the overlay never drifts from the textarea. */
export function tokenizeSql(sql: string): SqlToken[] {
  const out: SqlToken[] = [];
  let last = 0;
  for (const m of sql.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "plain", text: sql.slice(last, at) });
    const kind: SqlTokenKind = m[1] ? "comment" : m[2] ? "string" : m[3] ? "number" : KEYWORDS.has(m[4].toLowerCase()) ? "keyword" : "plain";
    out.push({ kind, text: m[0] });
    last = at + m[0].length;
  }
  if (last < sql.length) out.push({ kind: "plain", text: sql.slice(last) });
  return out;
}
