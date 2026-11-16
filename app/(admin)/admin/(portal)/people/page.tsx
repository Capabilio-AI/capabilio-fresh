import { requireAdminPage } from "@/lib/admin/db";
import { can, LOOKUP_MAX, LOOKUP_MIN, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import clsx from "clsx";
import { kindCounts, listPeople, type KindFilter } from "@/lib/admin/people";
import { Chip, Empty, ExportLink, PageHeader, Table, TD, when } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
const TABS: [KindFilter, string][] = [["all", "Everyone"], ["student", "Students"], ["graduate", "Graduates"], ["professional", "Professionals"], ["other", "Others"]];
const KIND_NOTE: Record<string, string> = { student: "Student", graduate: "Graduate", professional: "Professional", other: "No path yet" };

export default async function People({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string; page?: string }> }) {
  const admin = await requireAdminPage(["lists", "lookup"]); // the layout checks too, but a page fetched on its own must not rely on it
  const browse = can(admin, "lists"); // support can only look one person up
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const sp = await searchParams;
  const kind: KindFilter = TABS.some(([k]) => k === sp.kind) ? (sp.kind as KindFilter) : "all";
  const q = (sp.q ?? "").slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const lookupReady = browse || q.trim().length >= LOOKUP_MIN;
  const [found, counts] = await Promise.all([lookupReady ? listPeople({ kind: browse ? kind : "all", q, page: browse ? page : 1, nameOnly: !can(admin, "contacts") }) : Promise.resolve({ rows: [], total: 0, pages: 1 }), browse ? kindCounts() : Promise.resolve(null)]);
  const rows = browse ? found.rows : found.rows.slice(0, LOOKUP_MAX);
  const { total, pages } = found;
  const href = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const merged = { kind: kind === "all" ? null : kind, q: q || null, page: null, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== null && v !== "") p.set(k, String(v));
    const s = p.toString();
    return `/admin/people${s ? `?${s}` : ""}`;
  };
  return (
    <div>
      <PageHeader eyebrow="Directory" title="People" intro="Every account on Capabilio. Open a person to see where they study or work, the role they chose, their ratings, what they did, and every decision made about them." actions={can(admin, "export") ? <ExportLink kind="people" query={kind === "all" ? "" : `kind=${kind}`} /> : undefined} />
      {browse && counts && <nav aria-label="Path" className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => <Link key={k} href={href({ kind: k === "all" ? null : k })} aria-current={kind === k ? "page" : undefined} className={clsx("rounded-full px-4 py-2 font-lp-body text-[13px] font-bold transition-colors", kind === k ? "bg-[var(--m-ink)] text-white" : "border border-[var(--m-rule)] bg-white text-[var(--m-ink)] hover:border-[var(--m-ink)]")}>{label} <span className="tabular-nums opacity-70">{counts[k]}</span></Link>)}
      </nav>}
      <form className="mb-4" role="search">{kind !== "all" && <input type="hidden" name="kind" value={kind} />}<input name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search people" className="field-ring w-full max-w-md rounded-full border border-[var(--m-rule)] bg-white px-5 py-2.5 font-lp-body text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]" /></form>
      {!lookupReady ? <Empty title="Look someone up">Type at least {LOOKUP_MIN} characters of a name or email. Your role shows a few matches at a time, not the whole directory.</Empty> : rows.length === 0 ? <Empty title="No one found">{q ? "Try a different name or email." : "No accounts in this group yet."}</Empty> : (
        <>
          <Table head={["Person", "Path", "Headline", "Joined"]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-[var(--m-ground)]/50">
                <td className={TD}><Link href={`/admin/people/${p.id}`} className="font-bold hover:underline">{p.name ?? "No name"}</Link><span className="block text-[12px] text-[var(--m-muted)]">{show(p.email)}</span></td>
                <td className={TD}><Chip tone="plain">{KIND_NOTE[p.kind]}</Chip></td>
                <td className={`${TD} max-w-[320px] truncate`}>{p.headline ?? "—"}</td>
                <td className={TD}>{when(p.joinedAt)}</td>
              </tr>
            ))}
          </Table>
          <div className="mt-4 flex items-center justify-between font-lp-body text-[13px] text-[var(--m-muted)]">
            <span>{browse ? `${total} ${total === 1 ? "person" : "people"} · page ${Math.min(page, pages)} of ${pages}` : `Showing up to ${LOOKUP_MAX} matches`}</span>
            <span className={browse ? "flex gap-2" : "hidden"}>
              {page > 1 && <Link href={href({ page: page - 1 })} className="rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 font-bold text-[var(--m-ink)]">Previous</Link>}
              {page < pages && <Link href={href({ page: page + 1 })} className="rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 font-bold text-[var(--m-ink)]">Next</Link>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
