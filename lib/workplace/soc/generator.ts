import { makeRng } from "../rng";
import { FAMILIES, type ChainLine } from "./scenarios";
import { EDUCATIONAL_NOTICE, RUNBOOK, SOC_MAX_SUBMISSIONS, type FamilyKey, type LogLine, type PublicAlert, type SocContent, type SocField, type SocKey } from "./types";
import { assetsOf, makeCompany, noise, stamp, type Person } from "./world";

const NOISE_LINES = 230;

const DELIVERABLE: Record<SocField, string> = {
  disposition: "a disposition",
  severity: "a severity",
  technique: "the ATT&CK technique (for true positives)",
  action: "the containment action",
  escalate: "whether to escalate to L2",
  evidence: "the log line ids that prove it",
};

/**
 * Builds one shift: a fictional company, a few hundred log lines of ordinary traffic, and one incident chain per family, each raising one alert. Line ids
 * are given after sorting by time, so an id says nothing about which chain a line belongs to. Same seed, same shift.
 */
export function buildShift(seed: number, families: readonly FamilyKey[], ask: readonly SocField[]): { content: SocContent; key: SocKey } {
  const rng = makeRng(seed);
  const company = makeCompany(rng);
  const date = `2026-10-${String(rng.int(5, 28)).padStart(2, "0")}`;
  const admins = company.people.filter((p) => p.admin);
  const staff = rng.shuffle(company.people.filter((p) => !p.admin));
  const actorFor = (family: FamilyKey, i: number): Person => (family === "brute_force" && rng.chance(0.4) ? rng.pick(admins) : staff[i % staff.length]);

  const incidents = families.map((f, i) => FAMILIES[f](rng, company, actorFor(f, i)));
  type Tagged = ChainLine & { owner: number };
  const tagged: Tagged[] = [
    ...noise(rng, company, NOISE_LINES).map((l) => ({ ...l, owner: -1 })),
    ...incidents.flatMap((inc, owner) => inc.lines.map((l) => ({ ...l, owner }))),
  ].sort((a, b) => a.ts - b.ts);
  const withIds = tagged.map((l, i) => ({ ...l, id: `L${String(i + 1).padStart(4, "0")}` }));

  // unique ids handed out in a shuffled order, so an id says nothing about the family behind it
  let next = rng.int(1000, 8000);
  const alertIds = rng.shuffle(incidents.map((_, i) => i)).map((i) => ({ i, id: `ALR-${(next += rng.int(7, 97))}` }));
  const idOf = (i: number) => alertIds.find((a) => a.i === i)!.id;
  const alerts: PublicAlert[] = incidents
    .map((inc, i) => ({ id: idOf(i), ts: stamp(date, inc.alert.ts), rule: inc.alert.rule, summary: inc.alert.summary, host: inc.alert.host, user: inc.alert.user, order: inc.alert.ts }))
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...a }) => a);

  const key: SocKey = {
    alerts: Object.fromEntries(
      incidents.map((inc, i) => {
        const mine = withIds.filter((l) => l.owner === i);
        return [idOf(i), { ...inc.key, evidence: Array.from({ length: inc.groups }, (_, g) => mine.filter((l) => l.group === g).map((l) => l.id)), related: mine.map((l) => l.id) }];
      }),
    ),
  };
  const logs: LogLine[] = withIds.map((l) => ({ id: l.id, ts: stamp(date, l.ts), source: l.source, host: l.host, user: l.user, event: l.event, detail: l.detail }));
  const fields: SocField[] = ["disposition", ...ask.filter((f) => f !== "disposition")];
  const content: SocContent = {
    company: company.name,
    domain: company.domain,
    shiftDate: date,
    notice: EDUCATIONAL_NOTICE,
    alerts,
    logs,
    assets: assetsOf(company),
    runbook: [...RUNBOOK],
    ask: fields,
    maxSubmissions: SOC_MAX_SUBMISSIONS,
    deliverable: `For each of the ${alerts.length} alerts in the queue, record ${fields.map((f) => DELIVERABLE[f]).join(", ")}.`,
  };
  return { content, key };
}
