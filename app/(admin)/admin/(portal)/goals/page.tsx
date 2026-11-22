import { requireAdminPage } from "@/lib/admin/db";
import { listGoalDemand } from "@/lib/admin/goals";
import { Chip, Empty, PageHeader, Stat, Table, TD, when } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** What students asked for that nothing on Capabilio covers yet. The top of this list is the next pathway to write. */
export default async function Goals() {
  await requireAdminPage("lists");
  const rows = await listGoalDemand();
  const open = rows.filter((g) => !g.covered);
  return (
    <div>
      <PageHeader eyebrow="Pathways" title="Goals students asked for" intro="Goals typed into the goal box that no job role and no published pathway covered. Each is counted once per student. Write the pathway for the goals at the top first, from the official source, then publish it." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat tone="ink" label="Open goals" value={open.length} />
        <Stat label="Students who asked" value={open.reduce((n, g) => n + g.students, 0)} />
        <Stat label="Already covered" value={rows.length - open.length} />
      </div>
      {rows.length === 0 ? <Empty title="No goals yet">When a student types a goal we do not cover, it shows up here.</Empty> : (
        <Table head={["Goal", "Students", "Other wordings", "First asked", "Last asked", ""]}>
          {rows.map((g) => (
            <tr key={g.key} className="hover:bg-[var(--m-ground)]/50">
              <td className={`${TD} font-bold`}>{g.text}</td>
              <td className={`${TD} tabular-nums font-semibold`}>{g.students}</td>
              <td className={TD}>{g.wordings.length ? g.wordings.join(" · ") : "—"}</td>
              <td className={TD}>{when(g.firstAsked)}</td>
              <td className={TD}>{when(g.lastAsked)}</td>
              <td className={TD}>{g.covered ? <Chip tone="approved">Covered</Chip> : <Chip tone="pending">Open</Chip>}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
