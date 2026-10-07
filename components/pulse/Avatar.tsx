import clsx from "clsx";
import { initialsOf } from "@/lib/pulse/format";

const SIZE = { xs: "h-7 w-7 text-[10px]", sm: "h-9 w-9 text-[12px]", md: "h-11 w-11 text-[14px]", lg: "h-16 w-16 text-[20px]", xl: "h-24 w-24 text-[28px]" } as const;

export interface AvatarPerson {
  name: string | null;
  avatarUrl: string | null;
}

/** Photo or initials. `ring` draws the story ring: unseen = brand gradient, seen = quiet. */
export function Avatar({ person, size = "md", ring = "none", className }: { person: AvatarPerson; size?: keyof typeof SIZE; ring?: "none" | "unseen" | "seen"; className?: string }) {
  const face = (
    <span className={clsx("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-app-charcoal font-lp-display font-semibold text-white", SIZE[size], className)}>
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(person.name)
      )}
    </span>
  );
  if (ring === "none") return face;
  return (
    <span className={clsx("inline-flex rounded-full p-[2.5px]", ring === "unseen" ? "bg-gradient-to-tr from-app-orange via-[#f7a13a] to-[#e8467c]" : "bg-app-border")}>
      <span className="rounded-full bg-white p-[2px]">{face}</span>
    </span>
  );
}
