export type Slot = "avatar" | "cover";
export const SLOT_MAX_PX: Record<Slot, number> = { avatar: 512, cover: 1600 };
export const MAX_MB = 5;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Why an image cannot be used, or null. The live path checks again on the server. */
export function photoProblem(f: { type: string; size: number }): string | null {
  if (!TYPES.includes(f.type)) return "Use a JPG, PNG or WebP image.";
  if (f.size <= 0) return "That file is empty.";
  if (f.size > MAX_MB * 1024 * 1024) return `That image is over ${MAX_MB} MB.`;
  return null;
}

/** The size to draw an image at so its longest side fits `max`, never enlarging it. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
