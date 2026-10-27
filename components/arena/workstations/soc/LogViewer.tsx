import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import { Search } from "lucide-react";
import { LOG_SOURCES, type LogLine } from "@/lib/workplace/soc/types";
import { highlightSegments, searchTerms, type LogFilter } from "./helpers";
import { BTN, FOCUS, H, INPUT, PANEL, SOURCE_COLOR } from "./theme";

const MAX_SHOWN = 400;
const FORM_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) =>
        s.hit ? <mark key={i} className="rounded-sm bg-[#f6d24c] px-px text-[#1a1400]">{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

interface Props {
  total: number;
  matches: LogLine[];
  filter: LogFilter;
  onFilter: (patch: Partial<LogFilter>) => void;
  hosts: string[];
  users: string[];
  cited: Set<string>;
  canCite: boolean;
  disabled: boolean;
  alertId: string;
  onToggleCite: (id: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

/** Monospace log view: time column, source badges, highlighted matches, field filters. j/k move the cursor, c or Space cites the line, / focuses search. */
export function LogViewer({ total, matches, filter, onFilter, hosts, users, cited, canCite, disabled, alertId, onToggleCite, searchRef }: Props) {
  const [cursor, setCursor] = useState(0);
  const shown = matches.slice(0, MAX_SHOWN);
  const at = Math.min(cursor, Math.max(0, shown.length - 1));
  const terms = searchTerms(filter.query);
  const rowId = (id: string) => `soc-log-${id}`;
  const activeId = shown[at] ? rowId(shown[at].id) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function onKey(e: KeyboardEvent<HTMLElement>) {
    const t = e.target as HTMLElement;
    if (FORM_TAGS.has(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    const move = (d: number) => {
      e.preventDefault();
      setCursor(Math.max(0, Math.min(shown.length - 1, at + d)));
    };
    if (e.key === "j" || e.key === "ArrowDown") move(1);
    else if (e.key === "k" || e.key === "ArrowUp") move(-1);
    else if (t.getAttribute("role") === "listbox" && (e.key === "c" || e.key === " ") && canCite && !disabled && shown[at]) {
      e.preventDefault();
      onToggleCite(shown[at].id);
    }
  }

  const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 font-lp-mono text-[11px] font-semibold ${FOCUS} ${on ? "border-[var(--soc-accent)] bg-[var(--soc-raised)] text-[var(--soc-text)]" : "border-[var(--soc-line)] text-[var(--soc-muted)] hover:text-[var(--soc-text)]"}`;

  return (
    <section aria-labelledby="soc-logs-h" onKeyDown={onKey} className={`${PANEL} flex min-w-0 flex-col gap-2 p-3`}>
      <h3 id="soc-logs-h" className={H}>Log search · {total} lines, searched in your browser</h3>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[180px] flex-[2]">
          <span className="sr-only">Search logs (press / to focus)</span>
          <Search size={13} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--soc-muted)]" />
          <input ref={searchRef} value={filter.query} onChange={(e) => onFilter({ query: e.target.value })} placeholder="search: user, host, IP, event…   ( / )" className={`${INPUT} pl-7`} />
        </label>
        <label className="min-w-[110px] flex-1">
          <span className="sr-only">Filter by host</span>
          <input list="soc-hosts" value={filter.host} onChange={(e) => onFilter({ host: e.target.value })} placeholder="host" className={INPUT} />
          <datalist id="soc-hosts">{hosts.map((h) => <option key={h} value={h} />)}</datalist>
        </label>
        <label className="min-w-[110px] flex-1">
          <span className="sr-only">Filter by user</span>
          <input list="soc-users" value={filter.user} onChange={(e) => onFilter({ user: e.target.value })} placeholder="user" className={INPUT} />
          <datalist id="soc-users">{users.map((u) => <option key={u} value={u} />)}</datalist>
        </label>
      </div>
      <div role="group" aria-label="Filter by log source" className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!filter.source} onClick={() => onFilter({ source: "" })} className={chip(!filter.source)}>all</button>
        {LOG_SOURCES.map((s) => (
          <button key={s} type="button" aria-pressed={filter.source === s} onClick={() => onFilter({ source: filter.source === s ? "" : s })} className={chip(filter.source === s)}>
            <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_COLOR[s] }} />{s}
          </button>
        ))}
      </div>
      <p className="flex flex-wrap items-center justify-between gap-2 font-lp-mono text-[11px] text-[var(--soc-muted)]" aria-live="polite">
        <span>{matches.length} matching lines{matches.length > MAX_SHOWN ? `, first ${MAX_SHOWN} shown` : ""}</span>
        <span>{canCite ? `j/k move · c cites a line as evidence for ${alertId}` : "j/k move"}</span>
      </p>
      <div role="listbox" aria-label="Log lines" aria-activedescendant={activeId} tabIndex={0} className={`max-h-[420px] overflow-auto rounded-md border border-[var(--soc-line)] bg-[var(--soc-bg)] font-lp-mono text-[11.5px] ${FOCUS}`}>
        {shown.length === 0 && <p className="px-3 py-6 text-center text-[var(--soc-muted)]">No lines match. Loosen the search or clear a filter.</p>}
        {shown.map((l, i) => {
          const isCited = cited.has(l.id);
          return (
            <div key={l.id} id={rowId(l.id)} role="option" aria-selected={i === at} onClick={() => setCursor(i)} className={`flex items-start gap-2 border-b border-[var(--soc-line)]/60 px-2 py-1 ${i === at ? "bg-[var(--soc-raised)] shadow-[inset_2px_0_0_var(--soc-accent)]" : ""} ${isCited ? "bg-[rgba(98,219,165,0.09)]" : ""}`}>
              {canCite && (
                <button type="button" tabIndex={-1} aria-pressed={isCited} aria-label={`Cite ${l.id} for ${alertId}`} disabled={disabled} onClick={(e) => { e.stopPropagation(); onToggleCite(l.id); }} className={`mt-px h-4 w-4 shrink-0 rounded border text-[10px] leading-none ${isCited ? "border-[var(--soc-ok)] bg-[var(--soc-ok)] text-[#04210f]" : "border-[var(--soc-muted)] text-transparent hover:text-[var(--soc-muted)]"}`}>✓</button>
              )}
              <span className="w-[52px] shrink-0 text-[var(--soc-muted)]"><Marked text={l.id} terms={terms} /></span>
              <span className="w-[58px] shrink-0 text-[var(--soc-text)]"><Marked text={l.ts.slice(11, 19)} terms={terms} /></span>
              <span className="w-[66px] shrink-0 rounded px-1 text-center text-[10.5px] font-semibold uppercase" style={{ color: SOURCE_COLOR[l.source], background: "rgba(255,255,255,0.05)" }}>{l.source}</span>
              <span className="min-w-0 flex-1 break-words text-[var(--soc-text)]">
                <span className="text-[var(--soc-accent)]"><Marked text={l.event} terms={terms} /></span>{" "}
                <span className="text-[var(--soc-muted)]">host=</span><Marked text={l.host} terms={terms} />{" "}
                <span className="text-[var(--soc-muted)]">user=</span><Marked text={l.user} terms={terms} />{" "}
                <span className="break-all"><Marked text={l.detail} terms={terms} /></span>
              </span>
            </div>
          );
        })}
      </div>
      {(filter.query || filter.source || filter.host || filter.user || filter.range) && (
        <button type="button" onClick={() => onFilter({ query: "", source: "", host: "", user: "", range: null })} className={`${BTN} self-start`}>Clear all filters</button>
      )}
    </section>
  );
}
