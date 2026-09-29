"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export type FieldType = "text" | "textarea" | "select" | "url" | "datetime-local" | "date" | "number" | "checkbox" | "list";

export interface FormField {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: string | boolean;
}

const INPUT =
  "w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20";

/**
 * One generic POST-JSON form. The server route is the authority: this only collects fields, and `extra`
 * carries fixed ids (e.g. a group id) — never a role, institution or status.
 */
export function JsonForm({
  action,
  fields,
  submitLabel,
  extra,
  successMessage = "Saved.",
  resetOnSuccess = true,
}: {
  action: string;
  fields: FormField[];
  submitLabel: string;
  extra?: Record<string, unknown>;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const body: Record<string, unknown> = { ...extra };
    for (const f of fields) {
      const type = f.type ?? "text";
      if (type === "checkbox") {
        body[f.name] = data.get(f.name) === "on";
        continue;
      }
      const raw = String(data.get(f.name) ?? "").trim();
      if (raw === "") continue;
      if (f.name.startsWith("notes.")) {
        // "notes.<userId>" fields fold into one { notes: { <userId>: text } } object
        body.notes = { ...(body.notes as Record<string, string> | undefined), [f.name.slice("notes.".length)]: raw };
        continue;
      }
      if (type === "number") body[f.name] = Number(raw);
      else if (type === "datetime-local") body[f.name] = new Date(raw).toISOString();
      else if (type === "list") body[f.name] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      else body[f.name] = raw;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage({ ok: false, text: json?.error ?? "Something went wrong." });
        return;
      }
      setMessage({ ok: true, text: successMessage });
      if (resetOnSuccess) form.reset();
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Connection problem. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      {fields.map((f) => {
        const id = `${action}-${f.name}`;
        const type = f.type ?? "text";
        return (
          <div key={f.name}>
            {type === "checkbox" ? (
              <label className="flex items-center gap-2 font-lp-body text-[13px] text-app-charcoal">
                <input type="checkbox" name={f.name} defaultChecked={Boolean(f.defaultValue)} className="h-4 w-4 accent-[var(--app-orange,#f97316)]" />
                {f.label}
              </label>
            ) : (
              <>
                <label htmlFor={id} className="mb-1 block font-lp-body text-[12px] font-medium text-app-muted">
                  {f.label}
                  {f.required && <span className="text-app-orange"> *</span>}
                </label>
                {type === "textarea" ? (
                  <textarea id={id} name={f.name} rows={4} required={f.required} placeholder={f.placeholder} defaultValue={String(f.defaultValue ?? "")} className={INPUT} />
                ) : type === "select" ? (
                  <select id={id} name={f.name} required={f.required} defaultValue={String(f.defaultValue ?? "")} className={INPUT}>
                    {!f.required && <option value="">—</option>}
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    name={f.name}
                    type={type === "list" ? "text" : type}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={String(f.defaultValue ?? "")}
                    className={INPUT}
                  />
                )}
              </>
            )}
            {f.help && <p className="mt-1 font-lp-body text-[11.5px] text-app-muted">{f.help}</p>}
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {submitLabel}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`font-lp-body text-[12.5px] ${message.ok ? "text-app-success" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
