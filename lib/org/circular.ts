import { z } from "zod";

/** What we read from a circular. The college reviews and edits this before anything is posted. */
export const CircularDraftSchema = z.object({
  headline: z.string().max(200),
  body: z.string().max(5000),
  /** local date-time "YYYY-MM-DDTHH:mm" of the event itself, null when the circular names no event date */
  startsAt: z.string().nullable(),
  location: z.string().max(300).nullable(),
  isFest: z.boolean(),
});
export type CircularDraft = z.infer<typeof CircularDraftSchema>;

export const CIRCULAR_SYSTEM = `You read a circular, notice or press note that a college sent out as a PDF and turn it into a post for the college's public page.
Return JSON: {"headline","body","startsAt","location","isFest"}.
- Write in the SAME language as the document (Telugu stays Telugu). Never translate, never invent facts, names, dates or places that are not in the text.
- headline: the event or notice title, short.
- body: a clear summary of what it says (who, what, when, where, who may attend, how to register), plain text, under 1200 characters.
- startsAt: the date (and time if given) the EVENT happens as "YYYY-MM-DDTHH:mm" (use T09:00 when no time is given). If the document only reports on something that already happened, use that date. null when no event date is stated.
- location: the venue if stated, else null.
- isFest: true only for a college fest or cultural festival.`;

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Keeps only a start time the form's date-time input can show; anything else becomes "no date" so the college types it. */
export function cleanStartsAt(value: string | null): string | null {
  if (!value || !LOCAL_DATE_TIME.test(value)) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}
