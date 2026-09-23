"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}

export function PasswordField({ value, onChange, label = "Password", error }: PasswordFieldProps) {
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
          placeholder="Enter your password"
          autoComplete="current-password"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded border border-lp-border-hairline bg-lp-surface-card py-3 pl-4 pr-11 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
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
      {error && (
        <p id={errorId} className="mt-1.5 font-lp-mono text-lp-label-sm text-lp-error">
          {error}
        </p>
      )}
    </div>
  );
}
