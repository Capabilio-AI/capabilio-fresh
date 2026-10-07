"use client";

import { useState } from "react";
import clsx from "clsx";
import type { PostKind } from "@/lib/pulse/format";
import type { AvatarPerson } from "./Avatar";
import { PulseFeed } from "./PulseFeed";

const TABS: { key: PostKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "project", label: "Projects" },
  { key: "achievement", label: "Achievements" },
  { key: "question", label: "Questions" },
  { key: "post", label: "Posts" },
];

/** One person's posts, filterable by what kind they are. */
export function ProfileFeedTabs({ userId, viewer }: { userId: string; viewer: { id: string } & AvatarPerson }) {
  const [kind, setKind] = useState<PostKind | "all">("all");
  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-app-border px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Post types">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={kind === t.key} onClick={() => setKind(t.key)} className={clsx("relative shrink-0 px-3.5 py-3 font-lp-body text-[13.5px] font-medium", kind === t.key ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal")}>
            {t.label}
            {kind === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
          </button>
        ))}
      </div>
      <PulseFeed key={kind} view={{ mode: "user", userId, kind: kind === "all" ? undefined : kind }} viewer={viewer} />
    </div>
  );
}
