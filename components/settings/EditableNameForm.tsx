"use client";

import { useActionState } from "react";
import { updateFullName, type UpdateNameState } from "@/app/(app)/settings/actions";

const INITIAL_STATE: UpdateNameState = { status: "idle" };

export function EditableNameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState(updateFullName, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <input
        type="text"
        name="fullName"
        defaultValue={initialName}
        required
        maxLength={200}
        className="w-full max-w-xs rounded-lg border border-app-border bg-white px-3.5 py-2.5 font-lp-body text-[13.5px] text-app-charcoal focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-app-charcoal px-4 py-2.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.status === "success" && (
          <span className="font-lp-mono text-[11px] text-app-success">{state.message}</span>
        )}
        {state.status === "error" && (
          <span className="font-lp-mono text-[11px] text-app-warning">{state.message}</span>
        )}
      </div>
    </form>
  );
}
