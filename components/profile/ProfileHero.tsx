import { GraduationCap, Layers, MapPin, School, Target } from "lucide-react";
import { AvatarUpload } from "./AvatarUpload";
import { CoverUpload } from "./CoverUpload";
import { EditProfileDialog, type EditableProfile } from "./EditProfileDialog";

export interface ProfileHeroProps {
  profile: EditableProfile;
  avatarUrl: string | null;
  coverUrl: string | null;
  initials: string;
  aspiringFor: string | null;
  college: string | null;
  branch: string | null;
  graduatingYear: number | null;
}

/** The Capabilio line mark (three stations on one line) drawn large, so a student with no cover still has one that is clearly ours. */
function BrandCover() {
  return (
    <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 h-full w-full">
      <rect width="1200" height="220" fill="var(--m-ink)" />
      <path d="M-20 178H300L380 96H760L840 178H1220" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-20 178H300L380 96H760L840 178H1220" fill="none" stroke="var(--m-accent)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      {[120, 340, 570, 800, 1020].map((x) => {
        const y = x < 300 || x > 840 ? 178 : x < 380 ? 178 - ((x - 300) * 82) / 80 : 96;
        return <circle key={x} cx={x} cy={y} r="11" fill="var(--m-ink)" stroke="#fff" strokeWidth="4" />;
      })}
    </svg>
  );
}

const CHIP = "inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ground)] px-3 py-1 font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]";

export function ProfileHero({ profile, avatarUrl, coverUrl, initials, aspiringFor, college, branch, graduatingYear }: ProfileHeroProps) {
  return (
    <section aria-label="Profile" className="glass overflow-hidden rounded-2xl">
      <div className="relative h-36 sm:h-48">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user image, arbitrary origin
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <BrandCover />
        )}
        <CoverUpload hasCover={Boolean(coverUrl)} />
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-14 flex flex-wrap items-end justify-between gap-3 sm:-mt-16">
          <AvatarUpload avatarUrl={avatarUrl} initials={initials} large />
          <div className="pb-1"><EditProfileDialog profile={profile} /></div>
        </div>

        <h1 className="mt-3 text-balance font-lp-display text-[28px] font-bold leading-tight tracking-tight text-[var(--m-ink)] sm:text-[34px]">{profile.fullName}</h1>
        {profile.headline ? (
          <p className="mt-1 max-w-2xl font-lp-body text-[15px] leading-relaxed text-[var(--m-muted)]">{profile.headline}</p>
        ) : (
          <p className="mt-1 font-lp-body text-[14px] text-[var(--m-off)]">Add a headline so people know who you are in one line.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-accent-soft)] px-3 py-1 font-lp-body text-[12.5px] font-bold text-[var(--m-accent-ink)]">
            <Target size={13} aria-hidden /> Aspiring for: {aspiringFor ?? "not chosen yet"}
          </span>
          {college && <span className={CHIP}><School size={13} aria-hidden />{college}</span>}
          {branch && <span className={CHIP}><Layers size={13} aria-hidden />{branch}</span>}
          {graduatingYear != null && <span className={CHIP}><GraduationCap size={13} aria-hidden />Class of {graduatingYear}</span>}
          {profile.location && <span className={CHIP}><MapPin size={13} aria-hidden />{profile.location}</span>}
        </div>
      </div>
    </section>
  );
}
