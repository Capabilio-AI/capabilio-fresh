"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, GitBranch, Loader2, RefreshCw } from "lucide-react";

interface CodeDnaState {
  connected: boolean;
  username?: string;
  profileUrl?: string;
  verificationState?: "pending" | "verified" | "failed";
  verificationCode?: string;
  scanStatus?: "idle" | "scanning" | "failed";
  codeDnaScore?: number | null;
  confidenceLevel?: "low" | "medium" | "high" | null;
  repositoriesAnalyzed?: number | null;
  recruiterSummary?: string | null;
  lastScannedAt?: string | null;
  nextScanAt?: string | null;
  lastScanError?: string | null;
  canScanNow?: boolean;
}

const CONFIDENCE_LABEL: Record<string, string> = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" };

function relativeCooldown(nextScanAt: string | null | undefined): string | null {
  if (!nextScanAt) return null;
  const ms = new Date(nextScanAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60_000);
  return `Available again in ${minutes}m`;
}

export function CodeDnaCard() {
  const [state, setState] = useState<CodeDnaState | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/code-dna");
    setState(await res.json());
  }

  useEffect(() => {
    fetch("/api/code-dna")
      .then((res) => res.json())
      .then(setState);
  }, []);

  async function connect() {
    if (username.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/code-dna/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.username?.[0] ?? data.error ?? "Couldn't connect that username.");
      return;
    }
    await load();
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/code-dna/verify", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.verified) {
      setError(data.error ?? "Verification code not found in your bio yet.");
      return;
    }
    await load();
  }

  async function scan() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/code-dna/scan", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Scan failed.");
    }
    await load();
  }

  if (!state) {
    return (
      <div className="mb-5 flex justify-center rounded-xl border border-lp-border-hairline bg-lp-surface-card py-8 shadow-sm">
        <Loader2 size={18} className="animate-spin text-lp-accent-indigo" />
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-lp-border-hairline bg-lp-surface-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch size={17} className="text-lp-text-ink" />
        <h3 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Code DNA</h3>
      </div>

      {!state.connected && (
        <div className="flex flex-col gap-2">
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
            Connect your public GitHub to turn your real repositories, commits, and pull requests into verified
            engineering evidence.
          </p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="GitHub username"
              className="flex-1 rounded-lg border border-lp-border-hairline bg-lp-surface px-3.5 py-2.5 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
            />
            <button
              type="button"
              onClick={connect}
              disabled={busy || username.trim().length === 0}
              className="rounded-lg bg-lp-text-ink px-4 py-2.5 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Connecting…" : "Connect GitHub"}
            </button>
          </div>
        </div>
      )}

      {state.connected && state.verificationState === "pending" && (
        <div className="flex flex-col gap-2">
          <p className="font-lp-body text-lp-body-sm text-lp-text-ink">
            Add this code to your{" "}
            <a href={state.profileUrl} target="_blank" rel="noopener noreferrer" className="text-lp-accent-indigo hover:underline">
              GitHub bio
            </a>{" "}
            temporarily, so we can confirm the account is yours:
          </p>
          <code className="w-fit rounded-lg bg-lp-surface-subtle px-3 py-2 font-lp-mono text-lp-label-sm text-lp-text-ink">
            {state.verificationCode}
          </code>
          <button
            type="button"
            onClick={verify}
            disabled={busy}
            className="mt-1 w-fit rounded-lg bg-lp-text-ink px-4 py-2 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card disabled:opacity-60"
          >
            {busy ? "Checking…" : "I've added it — Verify"}
          </button>
        </div>
      )}

      {state.connected && state.verificationState === "verified" && state.codeDnaScore == null && (
        <div className="flex flex-col gap-2">
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
            <span className="font-medium text-lp-text-ink">@{state.username}</span> is verified. Run your first scan
            to build your Code DNA.
          </p>
          <button
            type="button"
            onClick={scan}
            disabled={busy || state.scanStatus === "scanning"}
            className="w-fit rounded-lg bg-lp-text-ink px-4 py-2 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card disabled:opacity-60"
          >
            {state.scanStatus === "scanning" ? "Scanning…" : "Run first scan"}
          </button>
        </div>
      )}

      {state.connected && state.codeDnaScore != null && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-lp-display text-lp-display-mobile font-semibold text-lp-text-ink">
                {state.codeDnaScore}
              </span>
              <div>
                <p className="flex items-center gap-1.5 font-lp-body text-lp-body-sm font-medium text-lp-text-ink">
                  <CheckCircle2 size={14} className="text-lp-success" />
                  @{state.username}
                </p>
                <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">
                  {CONFIDENCE_LABEL[state.confidenceLevel ?? "low"]} · {state.repositoriesAnalyzed ?? 0} repos analyzed
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={state.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-lp-border-hairline px-3 py-2 font-lp-mono text-lp-label-sm text-lp-text-muted hover:text-lp-text-ink"
              >
                <ExternalLink size={12} />
                GitHub
              </a>
              <button
                type="button"
                onClick={scan}
                disabled={busy || !state.canScanNow}
                title={!state.canScanNow ? (relativeCooldown(state.nextScanAt) ?? "Scan in progress") : undefined}
                className="flex items-center gap-1.5 rounded-lg bg-lp-text-ink px-3 py-2 font-lp-mono text-lp-label-sm font-semibold text-lp-surface-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={12} className={state.scanStatus === "scanning" ? "animate-spin" : undefined} />
                Refresh
              </button>
            </div>
          </div>

          {state.recruiterSummary && (
            <p className="mt-3 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">{state.recruiterSummary}</p>
          )}

          <Link
            href="/dashboard/vault/code-dna"
            className="mt-3 inline-block font-lp-mono text-lp-label-sm text-lp-accent-indigo hover:underline"
          >
            View full evidence breakdown
          </Link>

          {!state.canScanNow && relativeCooldown(state.nextScanAt) && (
            <p className="mt-1 font-lp-mono text-lp-label-sm text-lp-text-muted">{relativeCooldown(state.nextScanAt)}</p>
          )}
          {state.scanStatus === "failed" && state.lastScanError && (
            <p className="mt-1 font-lp-body text-lp-label-sm text-lp-error">Last scan failed: {state.lastScanError}</p>
          )}
        </div>
      )}

      {error && <p className="mt-2 font-lp-body text-lp-body-sm text-lp-error">{error}</p>}
    </div>
  );
}
