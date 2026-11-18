"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ApiError, assessApi } from "@/components/assess/api";

const WELCOME_URL = "/skillstudio?welcome=role";
const FAILED = "We couldn't set that role up just now. Please try again in a moment.";

/**
 * Chooses a role from Explore and goes to SkillStudio, where its modules and courses are. No assessment here: the role assessment comes
 * with the 3rd-year Plan B question. A role Capabilio has not built yet is resolved first (its skill plan is written once, for everyone).
 */
export function ChooseRoleButton({ name, careerId, solid }: { name: string; careerId?: string; solid?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const choose = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let id = careerId;
      if (!id) {
        const out = await assessApi.resolveRole(name);
        if (out.status !== "MATCHED" && out.status !== "GENERATED") {
          setMessage("message" in out ? out.message : FAILED);
          setBusy(false);
          return;
        }
        id = out.primary.careerId;
      }
      await assessApi.confirmRole(id, name, true);
      router.push(WELCOME_URL);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : FAILED);
      setBusy(false);
    }
  };

  const look = solid
    ? "mt-4 bg-[var(--m-ink)] text-white hover:-translate-y-0.5 active:scale-[0.97]"
    : "self-start border border-[var(--m-ink)] text-[var(--m-ink)]";
  return (
    <div className={clsx("flex flex-col gap-2", solid ? "items-start" : "self-start")}>
      <button type="button" onClick={choose} disabled={busy} aria-busy={busy} className={clsx("inline-flex rounded-full px-5 py-2.5 text-[14px] font-bold transition-transform disabled:opacity-70", look)}>
        {busy ? "Setting up your path…" : `Choose ${name}`}
      </button>
      {message && <p role="alert" className="font-lp-body text-[13px] text-app-muted">{message}</p>}
    </div>
  );
}
