import clsx from "clsx";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "P";

/** A person's photo, or their initials on the ink disc when they have none. */
export function ProAvatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a stored profile photo from the account's own storage
    <img src={url} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.38 }} className={clsx("grid shrink-0 place-items-center rounded-full bg-[var(--m-ink)] font-lp-display font-bold text-white")}>{initials(name)}</span>
  );
}
