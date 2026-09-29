"use client";

import { ORG_PERMISSIONS, ROLE_DEFAULTS, kindOf, type OrgPermissionKey } from "@/lib/org/roles";

/**
 * Checkbox list of what someone may do. `role` decides the starting set; `grantable` are the ones the editor is
 * allowed to hand out (the server enforces the same rule). Admin roles are always everything and cannot be edited.
 */
export function PermissionPicker({
  role,
  value,
  onChange,
  grantable,
}: {
  role: string;
  value: OrgPermissionKey[];
  onChange: (next: OrgPermissionKey[]) => void;
  grantable: readonly OrgPermissionKey[];
}) {
  const isAdminRole = kindOf(role) === "admin";
  const kind = kindOf(role);
  const defaults = kind ? ROLE_DEFAULTS[kind] : [];
  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between text-[11.5px] font-bold text-app-muted">
        <span>What they can do</span>
        {!isAdminRole && (
          <button type="button" className="font-semibold text-app-orange hover:underline" onClick={() => onChange(defaults.filter((p) => grantable.includes(p)))}>
            Reset to {kind === "tpo" ? "TPO" : "faculty"} defaults
          </button>
        )}
      </legend>
      {isAdminRole ? (
        <p className="rounded-xl border border-app-border bg-white/[0.03] px-3 py-2.5 text-[12.5px] text-app-muted">Vice Principals have full access to everything in the workspace.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {ORG_PERMISSIONS.map((p) => {
            const can = grantable.includes(p.key);
            const checked = value.includes(p.key);
            return (
              <li key={p.key}>
                <label className={`flex items-start gap-2.5 rounded-xl border border-app-border px-3 py-2.5 ${can ? "cursor-pointer hover:bg-white/[0.04]" : "cursor-not-allowed opacity-45"}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--app-orange)]"
                    checked={checked}
                    disabled={!can}
                    onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((k) => k !== p.key))}
                  />
                  <span>
                    <span className="block text-[12.5px] font-semibold text-app-charcoal">{p.label}</span>
                    <span className="block text-[11.5px] leading-snug text-app-muted">{p.hint}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
