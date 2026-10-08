"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ImportListItem } from "@/lib/curriculum/admin-data";
import type { BranchBoard } from "@/lib/curriculum/cohorts";
import { COURSE_GROUPS, GROUP_LABEL } from "@/lib/curriculum/composition";
import { Pill } from "@/components/org/ui";
import { Meter, StageTrack } from "@/components/org/widgets";
import { StatusPill } from "./bits";
import { api } from "./api";
import { AddRegulation } from "./AddRegulation";
import { ConfirmDialog } from "./ConfirmDialog";
import { LinkStudents } from "./LinkStudents";
import { NewVersionButton } from "./NewVersionButton";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The college's curricula, one card per branch and one row per regulation, with how its students line up against them. */
export function BranchBoards({ boards }: { boards: BranchBoard[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<ImportListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const r = await api("DELETE", `/api/admin/curriculum/imports/${removing.id}`);
    setBusy(false);
    setRemoving(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  if (boards.length === 0) {
    return <p className="rounded-xl border border-dashed border-app-border px-4 py-8 text-center font-lp-body text-[13px] text-app-muted">No curricula yet. Upload a syllabus above, one branch and regulation at a time, or start one by hand.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="font-lp-body text-[12.5px] text-app-rose" role="alert">{error}</p>}
      {boards.map((b) => (
        <section key={b.key} className="o-card flex flex-col gap-4 p-5" aria-label={b.branch}>
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-lp-body text-[16px] font-extrabold text-app-charcoal">{b.branch}</h2>
              <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{plural(b.students, "student")}{b.imports.length > 0 ? ` · ${plural(b.imports.length, "curriculum")}` : ""}</p>
            </div>
            <StudentLinkStatus board={b} />
          </header>
          {b.students > 0 && <CoverageMeter board={b} />}

          {b.imports.length === 0 ? (
            <p className="rounded-lg border border-dashed border-app-border px-3 py-3 font-lp-body text-[12.5px] text-app-muted">
              No curriculum is filed under exactly “{b.branch}”. Students are matched to a curriculum by the branch name, so if yours is stored under a different spelling these students will not get it — upload this branch under the same name, or ask them to update their branch.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {b.imports.map((i) => <RegulationRow key={i.id} item={i} board={b} onRemove={() => setRemoving(i)} />)}
            </ul>
          )}

          <LinkStudents board={b} />
          {b.imports.length > 0 && <AddRegulation branch={b.branch} />}
        </section>
      ))}
      <ConfirmDialog open={removing !== null} title={`Delete this ${removing?.branch ?? ""} curriculum?`} confirmLabel="Delete" danger busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove}>
        It disappears from your list. Nothing has been published, so students are not affected.
      </ConfirmDialog>
    </div>
  );
}

/** How many of the branch's students will get a published college curriculum in their roadmap. */
function CoverageMeter({ board }: { board: BranchBoard }) {
  const covered = board.publishedRegulations.length === 0 ? 0 : board.students - board.withoutPublished;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
        <span className="font-semibold text-app-charcoal">{covered} of {board.students} students on a published curriculum</span>
        <span className="text-app-muted">{Math.round((covered / Math.max(1, board.students)) * 100)}%</span>
      </div>
      <Meter value={covered} max={board.students} label="Students on a published curriculum" tone={covered === board.students ? "ok" : "gold"} />
    </div>
  );
}

function StudentLinkStatus({ board }: { board: BranchBoard }) {
  if (board.students === 0) return null;
  if (board.publishedRegulations.length === 0) return <Pill tone="warn">No published curriculum for these students</Pill>;
  if (board.withoutPublished > 0) return <Pill tone="warn">{plural(board.withoutPublished, "student")} on a regulation with no published curriculum</Pill>;
  if (board.regulationUnset > 0) return <Pill tone="info">{board.regulationUnset} without a regulation get the latest published</Pill>;
  return <Pill tone="ok">All students linked</Pill>;
}

function RegulationRow({ item, board, onRemove }: { item: ImportListItem; board: BranchBoard; onRemove: () => void }) {
  const s = item.summary;
  const linked = board.byRegulation.find((r) => (r.regulation.toLowerCase() === (item.regulation ?? "").trim().toLowerCase()))?.students ?? 0;
  const frozen = item.status === "PUBLISHED" || item.status === "ARCHIVED";
  const empty = s.yearCoverage.filter((y) => y.courses === 0).map((y) => `Year ${y.year}`);
  return (
    <li className="rounded-xl border border-app-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/org/curriculum/${item.id}`} className="font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">
            {item.regulation ?? "Regulation not stated"}{item.versionNo ? ` · v${item.versionNo}` : ""}
          </Link>
          <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">
            {plural(linked, "student")} on this regulation · {s.outcomes} outcomes · {s.confirmedMappings} confirmed skills{s.mappingsNeedingReview > 0 ? ` · ${s.mappingsNeedingReview} to review` : ""}
          </p>
        </div>
        <StatusPill status={item.status} />
        <Link href={`/org/curriculum/${item.id}`} className="o-btn-ghost !px-3 !py-1.5 !text-[12px]">{frozen ? "View" : "Continue review"}</Link>
        {item.status === "PUBLISHED" && <NewVersionButton importId={item.id} ghost />}
        {!frozen && <button type="button" aria-label={`Delete ${item.branch}${item.regulation ? ` ${item.regulation}` : ""}`} className="text-app-muted hover:text-app-charcoal" onClick={onRemove}><Trash2 size={14} aria-hidden="true" /></button>}
      </div>

      <div className="mt-3">
        <StageTrack
          steps={[
            { label: "Uploaded", done: s.courses > 0 },
            { label: "Reviewed", done: s.courses > 0 && s.mappingsNeedingReview === 0 },
            { label: "Skills confirmed", done: s.confirmedMappings > 0 },
            { label: "Published", done: item.status === "PUBLISHED" },
          ]}
        />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="o-eyebrow">{s.courses} {s.courses === 1 ? "entry" : "entries"} in the syllabus</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">{COURSE_GROUPS.filter((g) => s.composition[g] > 0).map((g) => <Pill key={g}>{s.composition[g]} {GROUP_LABEL[g].toLowerCase()}</Pill>)}{s.courses === 0 && <span className="font-lp-body text-[12px] text-app-muted">No courses yet</span>}</dd>
        </div>
        <div>
          <dt className="o-eyebrow">By year of study</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">{s.yearCoverage.map((y) => <Pill key={y.year} tone={y.courses ? "neutral" : "warn"}>Y{y.year} · {y.courses}</Pill>)}</dd>
        </div>
      </dl>
      {s.courses > 0 && empty.length > 0 && <p className="mt-2 font-lp-body text-[12px] text-app-warning">Nothing uploaded for {empty.join(", ")} yet.</p>}
    </li>
  );
}
