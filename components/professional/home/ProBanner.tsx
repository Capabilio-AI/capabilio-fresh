import type { ReactNode } from "react";
import { ProAvatar } from "@/components/professional/pulse/ProAvatar";

/** Cover picture with the photo over its corner and the name and role beside it. `controls` holds the upload buttons on the edit page. */
export function ProBanner({ name, line, coverUrl, avatarUrl, coverControls, avatarControls }: { name: string; line: string | null; coverUrl: string | null; avatarUrl: string | null; coverControls?: ReactNode; avatarControls?: ReactNode }) {
  return (
    <section aria-label="Cover and photo" className="overflow-hidden rounded-3xl border border-[var(--m-rule)] bg-white">
      <div className="relative h-[130px] bg-[var(--m-accent-soft)] sm:h-[190px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage-hosted cover, arbitrary origin */}
        {coverUrl && <img src={coverUrl} alt="" className="size-full object-cover" />}
        {coverControls}
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
        <div className="relative -mt-12 shrink-0 sm:-mt-14">
          <span className="block overflow-hidden rounded-full border-4 border-white bg-white"><ProAvatar name={name} url={avatarUrl} size={104} /></span>
          {avatarControls}
        </div>
        <div className="min-w-0 flex-1 pt-3">
          <h1 className="font-lp-display text-[26px] font-bold leading-tight tracking-tight text-[var(--m-ink)] sm:text-[32px]">{name}</h1>
          {line && <p className="text-[15px] text-[var(--m-muted)]">{line}</p>}
        </div>
      </div>
    </section>
  );
}
