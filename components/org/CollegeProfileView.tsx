import { Check, Circle } from "lucide-react";
import type { OrgFacts, PublicOrg, PublicPost, WallEntry } from "@/lib/org/public-org";
import { MIN_COHORT } from "@/lib/org/insights";
import { splitEvents } from "@/lib/org/events";
import { CollegeHeader, type TabId } from "./CollegeHeader";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { JsonForm } from "./JsonForm";
import { Collapsible, EmptyState } from "./ui";

function StatStrip({ cells }: { cells: { label: string; value: string; tone: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-app-border bg-app-border md:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="px-4 py-5" style={{ backgroundColor: "#100e0b", backgroundImage: "linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025))" }}>
          <p className={`text-[32px] font-black leading-none tracking-[-0.04em] ${c.tone}`}>{c.value}</p>
          <p className="o-eyebrow mt-2">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Real signals only — each line is a fact in the database, and none implies a review that hasn't happened. */
function ProfileChecks({ org, facts }: { org: PublicOrg; facts: OrgFacts }) {
  const checks = [
    { ok: org.verified, label: "Approved by the Capabilio team" },
    { ok: Boolean(org.profile?.website_url), label: "Website provided" },
    { ok: Boolean(org.profile?.bio), label: "About section written" },
    { ok: org.studentCount > 0, label: "Students on the platform" },
    { ok: facts.placedCount !== null, label: "Confirmed placement records" },
  ];
  return (
    <section className="o-card p-5" aria-label="Profile checks">
      <h2 className="text-[13px] font-extrabold text-app-charcoal">Profile checks</h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2.5 text-[12.5px]">
            <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] ${c.ok ? "bg-app-success-container text-app-success" : "bg-white/[0.06] text-app-muted"}`} aria-hidden="true">
              {c.ok ? <Check size={11} strokeWidth={3} /> : <Circle size={9} />}
            </span>
            <span className={c.ok ? "text-app-charcoal" : "text-app-muted"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DepartmentGrid({ facts }: { facts: OrgFacts }) {
  if (facts.departments.length === 0) {
    return <EmptyState title="Departments appear as students join" body={`A department is listed once at least ${MIN_COHORT} students have joined it, so no small group can be singled out.`} />;
  }
  const top = facts.departments[0].students;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {facts.departments.map((d, i) => (
        <div key={d.branch} className="o-card relative overflow-hidden p-5" style={i === 0 ? { borderColor: "rgba(246,196,83,.3)", backgroundImage: "linear-gradient(160deg,rgba(220,139,24,.11),rgba(246,196,83,.04))" } : undefined}>
          <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-app-charcoal">{d.branch}</p>
          <p className="mt-1 text-[12px] text-app-muted">{d.students.toLocaleString("en-IN")} students on Capabilio</p>
          <span className="mt-4 block h-[3px] overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${(d.students / top) * 100}%`, background: "var(--o-gradient)" }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export interface ProfileViewProps {
  org: PublicOrg;
  facts: OrgFacts;
  wall: WallEntry[];
  posts: PublicPost[];
  tab: TabId;
  signedIn: boolean;
  /** "/o/<slug>" (visitors) or "/org/college" (inside the workspace) */
  basePath: string;
  workspace?: boolean;
  /** may edit logo, cover and details */
  canEditPage?: boolean;
  /** may write posts */
  canPost?: boolean;
  /** post ids the viewer may edit / delete */
  manageablePostIds?: ReadonlySet<string>;
  openEdit?: boolean;
}

/** One college profile, two contexts: the public page visitors see, and the same page inside the workspace. */
export function CollegeProfileView({ org, facts, wall, posts, tab, signedIn, basePath, workspace = false, canEditPage = false, canPost = false, manageablePostIds, openEdit = false }: ProfileViewProps) {
  const { upcoming, past } = splitEvents(posts);
  const bio = org.profile?.bio;
  const card = (p: PublicPost) => (
    <PostCard key={p.id} post={p} slug={org.slug} orgName={org.name} logoUrl={org.profile?.logo_url ?? null} manage={manageablePostIds?.has(p.id) ?? false} />
  );

  const editForm = canEditPage && (
    <Collapsible title="Edit page details" defaultOpen={openEdit}>
      <JsonForm
        action="/api/org/profile"
        submitLabel="Save page"
        successMessage="Saved."
        resetOnSuccess={false}
        fields={[
          { name: "tagline", label: "Tagline", placeholder: "One line about your college", defaultValue: org.profile?.tagline ?? "" },
          { name: "foundedYear", label: "Founded", type: "number", defaultValue: org.profile?.founded_year ? String(org.profile.founded_year) : "" },
          { name: "city", label: "City", defaultValue: org.city ?? "" },
          { name: "state", label: "State", defaultValue: org.state ?? "" },
          { name: "collegeCode", label: "College roll-number code — the letters in your students' roll numbers (e.g. AJ for 13AJ5A0405). Unique per college. Students must enter a roll number containing it; those who don't are flagged, and students with no roll number are removed after 7 days.", placeholder: "e.g. AJ", defaultValue: org.collegeCode ?? "" },
          { name: "websiteUrl", label: "Website", type: "url", placeholder: "https://…", defaultValue: org.profile?.website_url ?? "" },
          { name: "bio", label: "About", type: "textarea", defaultValue: bio ?? "" },
          { name: "isPublic", label: "Make this page public — anyone with the link can see it, and events are visible to everyone", type: "checkbox", defaultValue: org.profile?.is_public ?? false },
        ]}
      />
    </Collapsible>
  );

  return (
    <>
      <CollegeHeader org={org} signedIn={signedIn} tab={tab} basePath={basePath} canEditPage={canEditPage} workspace={workspace} />
      <main className="mx-auto grid max-w-[1120px] grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {editForm}

          {tab === "home" && (
            <>
              <StatStrip
                cells={[
                  { label: "Students on Capabilio", value: org.studentCount.toLocaleString("en-IN"), tone: "text-app-blue" },
                  { label: "Departments", value: String(facts.departments.length), tone: "text-app-orange" },
                  { label: "Followers", value: org.followerCount.toLocaleString("en-IN"), tone: "text-app-charcoal" },
                  facts.placedCount !== null ? { label: "Students placed", value: String(facts.placedCount), tone: "text-app-success" } : { label: "Upcoming events", value: String(facts.upcomingEvents), tone: "text-app-success" },
                ]}
              />
              {canPost && <PostComposer orgName={org.name} logoUrl={org.profile?.logo_url ?? null} />}
              {posts.length === 0 ? (
                <EmptyState title="No posts yet" body={canPost ? "Share your first update — an announcement, a photo or an event." : "Published events and announcements from this college appear here."} />
              ) : (
                <div className="flex flex-col gap-4">{posts.map(card)}</div>
              )}
            </>
          )}

          {tab === "about" && (
            <section className="o-card p-6">
              <h2 className="o-serif text-[28px] text-app-charcoal">About</h2>
              {bio ? (
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-app-charcoal">{bio}</p>
              ) : (
                <p className="mt-3 text-[13px] text-app-muted">{workspace ? "Add an About section with Edit page." : "This college hasn't written an About section yet."}</p>
              )}
              <dl className="mt-6 grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="o-eyebrow">Location</dt>
                  <dd className="mt-1 text-app-charcoal">{[org.city, org.state].filter(Boolean).join(", ") || "Not listed"}</dd>
                </div>
                <div>
                  <dt className="o-eyebrow">Founded</dt>
                  <dd className="mt-1 text-app-charcoal">{org.profile?.founded_year ?? "Not listed"}</dd>
                </div>
                <div>
                  <dt className="o-eyebrow">Website</dt>
                  <dd className="mt-1 text-app-charcoal">
                    {org.profile?.website_url ? (
                      <a href={org.profile.website_url} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">
                        {org.profile.website_url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "Not listed"
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {tab === "events" && (
            <>
              <h2 className="o-serif text-[28px] text-app-charcoal">Upcoming events</h2>
              {upcoming.length === 0 ? <EmptyState title="No upcoming events" body="Events this college publishes show up here with a way to say you'll attend." /> : upcoming.map(card)}
              {past.length > 0 && (
                <>
                  <h2 className="o-serif mt-4 text-[28px] text-app-charcoal">Past events</h2>
                  {past.map(card)}
                </>
              )}
            </>
          )}

          {tab === "placements" && (
            <>
              <StatStrip
                cells={[
                  { label: "Students placed", value: facts.placedCount !== null ? String(facts.placedCount) : "—", tone: "text-app-success" },
                  { label: "Companies", value: facts.companies !== null ? String(facts.companies) : "—", tone: "text-app-orange" },
                ]}
              />
              {facts.placedCount === null && <p className="text-[12.5px] text-app-muted">Totals appear once at least {MIN_COHORT} placements are confirmed, so no individual offer can be inferred.</p>}
              <h2 className="o-serif text-[28px] text-app-charcoal">Placement wall</h2>
              {wall.length === 0 ? (
                <EmptyState title="No one has chosen to appear yet" body="Confirmed placements show here only when the student agrees. Pay is never shown." />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {wall.map((w) => (
                    <li key={w.id} className="o-card flex items-center gap-3 p-4">
                      <span className="o-logo-tile h-11 w-11 shrink-0 rounded-[14px] text-[15px]" aria-hidden="true">
                        {w.company.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-bold text-app-charcoal">{w.name}</p>
                        <p className="truncate text-[12px] text-app-muted">
                          {w.roleTitle} at {w.company}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "departments" && (
            <>
              <h2 className="o-serif text-[28px] text-app-charcoal">Departments</h2>
              <DepartmentGrid facts={facts} />
              {facts.otherStudents > 0 && <p className="text-[12px] text-app-muted">{facts.otherStudents} more students are in departments too small to list.</p>}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {tab !== "about" && bio && (
            <section className="o-card p-5">
              <h2 className="text-[13px] font-extrabold text-app-charcoal">About</h2>
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-[13px] leading-relaxed text-app-muted">{bio}</p>
            </section>
          )}
          <ProfileChecks org={org} facts={facts} />
        </aside>
      </main>
    </>
  );
}
