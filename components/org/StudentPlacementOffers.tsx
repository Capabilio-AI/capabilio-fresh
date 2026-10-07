import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { ActionButton } from "@/components/org/ActionButton";

interface Placement {
  id: string;
  company: string;
  role_title: string;
  show_on_wall: boolean;
  offer_letter_path: string | null;
  student_response: "pending" | "accepted" | "declined";
}

/** Released offers for this student, with accept/decline and public-wall consent. Renders nothing when there are none. */
export async function StudentPlacementOffers({ userId }: { userId: string }) {
  const { data } = await untyped(createServiceClient())
    .from("org_placements")
    .select("id, company, role_title, show_on_wall, offer_letter_path, student_response")
    .eq("student_user_id", userId);
  const placements = (data ?? []) as Placement[];
  if (placements.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-app-border bg-white p-5" aria-label="Your placement">
      <h2 className="font-lp-body text-[15px] font-semibold text-app-charcoal">Congratulations — your offer was released</h2>
      <ul className="mt-3 flex flex-col gap-5">
        {placements.map((p) => (
          <li key={p.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">
                  {p.role_title} · {p.company}
                </p>
                <p className="font-lp-body text-[12px] text-app-muted">
                  {p.student_response === "accepted" ? "You accepted this offer." : p.student_response === "declined" ? "You declined this offer." : "Review the offer, then accept or decline. Your placement team sees your answer."}
                </p>
              </div>
              {p.offer_letter_path && (
                <a href={`/api/offer-letter/${p.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] font-semibold text-app-blue hover:bg-black/5">
                  Open offer letter
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p.student_response !== "accepted" && <ActionButton action="/api/classroom/placement-response" body={{ placementId: p.id, response: "accepted" }} label="Accept offer" />}
              {p.student_response !== "declined" && <ActionButton action="/api/classroom/placement-response" body={{ placementId: p.id, response: "declined" }} label="Decline offer" variant="danger" confirm="Decline this offer?" />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border pt-3">
              <p className="font-lp-body text-[12px] text-app-muted">
                {p.show_on_wall ? "Shown on your college's public page (name, company and role — never your pay)." : "Not shown publicly. Only you and your placement team can see it."}
              </p>
              <ActionButton action="/api/classroom/placement-consent" body={{ placementId: p.id, show: !p.show_on_wall }} label={p.show_on_wall ? "Hide from public page" : "Show on public page"} variant="ghost" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
