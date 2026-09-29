import { CheckCircle2, Circle, Clock } from "lucide-react";
import { CardChrome } from "./CardChrome";

interface PendingApprovalCardProps {
  organisationName: string | null;
  orgType: "institution" | "company" | null;
  onBack: () => void;
}

// Not an error: the account exists and is verified, and is waiting for a human check.
export function PendingApprovalCard({ organisationName, orgType, onBack }: PendingApprovalCardProps) {
  const steps = [
    { label: "Application submitted", done: true },
    { label: "Email confirmed", done: true },
    { label: "Manual approval by our team", done: false },
  ];
  return (
    <CardChrome label="capabilio / approval-status">
      <div className="text-center" data-testid="pending-approval">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-ochre">
          <Clock size={20} />
        </div>
        <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Approval pending</h1>
        <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
          {organisationName ? <strong className="text-lp-text-ink">{organisationName}</strong> : "Your organisation"} is waiting for manual
          approval. Nothing is wrong &mdash; you can sign in once we have approved it.
          {orgType === "company" && " Company accounts aren\u2019t open yet; we\u2019ll be in touch."}
        </p>
      </div>
      <ol className="mt-6 flex flex-col gap-3 rounded-lg border border-lp-border-hairline bg-lp-surface-subtle p-space-md">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 font-lp-body text-lp-body-sm text-lp-text-ink">
            {s.done ? <CheckCircle2 size={16} className="text-lp-accent-indigo" /> : <Circle size={16} className="text-lp-accent-ochre" />}
            <span className={s.done ? "" : "font-medium"}>{s.label}</span>
            {!s.done && <span className="ml-auto font-lp-mono text-lp-label-sm text-lp-accent-ochre">IN PROGRESS</span>}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 w-full rounded border border-lp-border-hairline py-3 font-lp-body text-lp-body-sm font-medium text-lp-text-ink transition-colors hover:bg-lp-surface-subtle"
      >
        Back to sign in
      </button>
    </CardChrome>
  );
}
