import { ChevronDown } from "lucide-react";
import { getRole, ROLES, RoleId } from "./roles";

interface RoleSelectorProps {
  value: RoleId;
  onChange: (role: RoleId) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const selected = getRole(value);
  const Icon = selected.icon;

  return (
    <div>
      <label htmlFor="role" className="mb-2 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant">
        Continue as
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lp-accent-indigo"
        >
          <Icon size={17} />
        </span>
        <select
          id="role"
          value={value}
          onChange={(e) => onChange(e.target.value as RoleId)}
          className="w-full appearance-none rounded border border-lp-border-hairline bg-lp-surface-card py-3 pl-11 pr-10 font-lp-body text-lp-body-sm font-medium text-lp-text-ink transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
        >
          {ROLES.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-lp-text-muted"
        />
      </div>
      <p className="mt-2 font-lp-mono text-lp-label-sm text-lp-text-muted">
        You&apos;ll continue to the <span className="text-lp-text-ink">{selected.portal}</span>.
      </p>
    </div>
  );
}
