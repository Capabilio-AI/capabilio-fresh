"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen } from "lucide-react";
import type { AlertAnswer, SocContent } from "@/lib/workplace/soc/types";
import { useDraft, type ToolProps } from "./useDraft";
import { AlertDetail } from "./soc/AlertDetail";
import { AlertQueue } from "./soc/AlertQueue";
import { DecisionPanel } from "./soc/DecisionPanel";
import { distinct, EMPTY_FILTER, filterLogs, type LogFilter } from "./soc/helpers";
import { LogViewer } from "./soc/LogViewer";
import { AssetPanel, RunbookDrawer } from "./soc/SidePanels";
import { SOC_VARS, BTN, FOCUS } from "./soc/theme";
import { Timeline } from "./soc/Timeline";

type Tab = "queue" | "logs" | "decide";
const TABS: { key: Tab; label: string }[] = [
  { key: "queue", label: "Queue" },
  { key: "logs", label: "Logs" },
  { key: "decide", label: "Decision" },
];

/**
 * SOC Console: an alert queue, a client-side search over the shift's synthetic logs, and a decision per alert. Searching is free and never graded;
 * only the decisions are sent, and the server checks them against a key this page never receives. Composition root: state lives here, panels live in ./soc.
 */
export function SocTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<SocContent>) {
  const [answers, setAnswers] = useDraft<Record<string, AlertAnswer>>(attemptId, "answers", {});
  const [note, setNote] = useDraft(attemptId, "note", "");
  const [selected, setSelected] = useState(content.alerts[0]?.id ?? "");
  const [filter, setFilter] = useState<LogFilter>(EMPTY_FILTER);
  const [tab, setTab] = useState<Tab>("queue");
  const [runbook, setRunbook] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = answers[selected] ?? {};
  const update = (patch: AlertAnswer) => setAnswers({ ...answers, [selected]: { ...current, ...patch } });
  const cited = new Set(current.evidence ?? []);
  const toggleCite = (id: string) => update({ evidence: cited.has(id) ? [...cited].filter((x) => x !== id) : [...cited, id] });

  const matches = useMemo(() => filterLogs(content.logs, filter), [content.logs, filter]);
  const hosts = useMemo(() => distinct(content.logs, "host"), [content.logs]);
  const users = useMemo(() => distinct(content.logs, "user"), [content.logs]);
  const logById = useMemo(() => new Map(content.logs.map((l) => [l.id, l])), [content.logs]);
  const decided = content.alerts.filter((a) => !!answers[a.id]?.disposition).length;
  const complete = decided === content.alerts.length;
  const alert = content.alerts.find((a) => a.id === selected);
  const patchFilter = (patch: Partial<LogFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const pivot = (field: "host" | "user", value: string) => {
    patchFilter({ [field]: value });
    setTab("logs");
  };

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (e.key === "Escape" && runbook) setRunbook(false);
    if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setTab("logs");
      searchRef.current?.focus();
    }
  }

  // a pane shows when its tab is active on phones; from md up every pane is visible
  const pane = (t: Tab) => (tab === t ? "flex" : "hidden md:flex");

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg border border-app-border bg-app-background px-4 py-2 font-lp-body text-[12px] text-app-muted">{content.notice}</p>

      <div style={SOC_VARS} onKeyDown={onKey} className="relative isolate min-w-0 overflow-hidden rounded-xl border border-[var(--soc-line)] bg-[var(--soc-bg)] text-[var(--soc-text)]">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--soc-line)] bg-[var(--soc-panel)] px-3 py-2">
          <span className="flex items-center gap-2 font-lp-mono text-[12px] font-semibold text-[var(--soc-text)]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--soc-ok)]" /> SOC CONSOLE · {content.company}
          </span>
          <span className="font-lp-mono text-[11px] text-[var(--soc-muted)]">shift {content.shiftDate} · {content.alerts.length} open alerts · {content.logs.length} events</span>
          <span className="font-lp-mono text-[11px] font-semibold text-[var(--soc-accent)]" aria-live="polite">{decided}/{content.alerts.length} alerts dispositioned</span>
          <button type="button" onClick={() => setRunbook((o) => !o)} aria-expanded={runbook} aria-controls="soc-runbook" className={`${BTN} ml-auto flex items-center gap-1.5`}>
            <BookOpen size={13} aria-hidden /> Runbook
          </button>
        </header>

        <div role="tablist" aria-label="Console views" className="flex border-b border-[var(--soc-line)] md:hidden">
          {TABS.map((t) => (
            <button key={t.key} role="tab" id={`soc-tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`soc-pane-${t.key}`} type="button" onClick={() => setTab(t.key)} className={`flex-1 border-b-2 px-2 py-2.5 font-lp-body text-[12.5px] font-semibold ${FOCUS} ${tab === t.key ? "border-[var(--soc-accent)] text-[var(--soc-text)]" : "border-transparent text-[var(--soc-muted)]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 p-3 md:grid-cols-[230px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)_330px]">
          <div id="soc-pane-queue" role="tabpanel" aria-labelledby="soc-tab-queue" className={`${pane("queue")} min-w-0 flex-col gap-3`}>
            <AlertQueue alerts={content.alerts} answers={answers} ask={content.ask} selected={selected} onSelect={(id) => { setSelected(id); setTab("logs"); }} shiftDate={content.shiftDate} />
            <AssetPanel assets={content.assets} onPivot={(name) => pivot("host", name)} />
          </div>

          <div id="soc-pane-logs" role="tabpanel" aria-labelledby="soc-tab-logs" className={`${pane("logs")} min-w-0 flex-col gap-3`}>
            {alert && <AlertDetail alert={alert} onPivot={pivot} />}
            <Timeline logs={content.logs} matches={matches} alerts={content.alerts} range={filter.range ?? null} onRange={(range) => patchFilter({ range })} />
            <LogViewer total={content.logs.length} matches={matches} filter={filter} onFilter={patchFilter} hosts={hosts} users={users} cited={cited} canCite={content.ask.includes("evidence")} disabled={closed} alertId={selected} onToggleCite={toggleCite} searchRef={searchRef} />
          </div>

          <div id="soc-pane-decide" role="tabpanel" aria-labelledby="soc-tab-decide" className={`${pane("decide")} min-w-0 flex-col md:col-span-2 lg:col-span-1`}>
            {alert && (
              <DecisionPanel alertId={alert.id} answer={current} ask={content.ask} logById={logById} closed={closed} submitting={submitting} complete={complete} decidedAlerts={decided} totalAlerts={content.alerts.length} note={note} onNote={setNote} onChange={update} onToggleCite={toggleCite} onSubmit={() => onSubmit({ alerts: answers, note: note.trim() || undefined })} />
            )}
          </div>
        </div>

        <RunbookDrawer open={runbook} onClose={() => setRunbook(false)} items={content.runbook} />
      </div>
    </div>
  );
}
