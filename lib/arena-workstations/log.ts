/**
 * Structured operational log line for Arena workstations. Callers pass ids,
 * keys, counts and durations only — never tokens, datasets, submissions or
 * answer keys.
 */
export function logArenaEvent(event: string, fields: Record<string, string | number | boolean | null | undefined>): void {
  const line = JSON.stringify({ scope: "arena-workstation", event, at: new Date().toISOString(), ...fields });
  if (event.endsWith("failed") || event.endsWith("error")) console.error(line);
  else console.info(line);
}
