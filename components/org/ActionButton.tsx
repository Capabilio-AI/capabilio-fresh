"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** One-click POST (join a group, approve a member, publish a post…). The server decides whether it is allowed. */
export function ActionButton({
  action,
  body,
  label,
  variant = "primary",
  confirm,
}: {
  action: string;
  body: Record<string, unknown>;
  label: string;
  variant?: "primary" | "ghost" | "danger";
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong.");
        if (res.status === 401) window.location.href = "/login";
        return;
      }
      router.refresh();
    } catch {
      setError("Connection problem.");
    } finally {
      setBusy(false);
    }
  }

  const styles = {
    primary: "bg-app-charcoal text-white hover:opacity-90",
    ghost: "border border-app-border bg-white text-app-charcoal hover:bg-black/5",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  }[variant];

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-lp-body text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${styles}`}
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {label}
      </button>
      {error && (
        <span role="alert" className="font-lp-body text-[11.5px] text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
