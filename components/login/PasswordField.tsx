"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  /** Show a live strength meter under the field (for choosing a new password). */
  meter?: boolean;
}

const STRENGTH = [
  { label: "Too short", color: "#d64545" },
  { label: "Weak", color: "#e0801a" },
  { label: "Fair", color: "#d9b200" },
  { label: "Good", color: "#5aa83c" },
  { label: "Strong", color: "#17784a" },
];

function strengthOf(pw: string): number {
  if (!pw) return -1;
  if (pw.length < 8) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return Math.max(1, Math.min(4, kinds - 1 + (pw.length >= 12 ? 1 : 0)));
}

export function PasswordField({ value, onChange, label = "Password", error, placeholder = "Enter your password", autoComplete = "current-password", meter = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded border border-lp-border-hairline! bg-lp-surface-card py-3 pl-4 pr-11 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo! focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-lp-text-muted transition-colors hover:text-lp-text-ink focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <span className="cap-meter flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <i key={n} style={{ background: n <= Math.max(1, strengthOf(value)) ? STRENGTH[strengthOf(value)].color : undefined }} />
            ))}
          </span>
          <span className="font-lp-mono text-lp-label-sm text-lp-text-muted">{STRENGTH[strengthOf(value)].label}</span>
        </div>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 font-lp-mono text-lp-label-sm text-lp-error">
          {error}
        </p>
      )}
    </div>
  );
}
