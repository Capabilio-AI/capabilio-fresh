/** Class strings shared by the professional pages, built from the app's own tokens (see components/metro/metro.css). */
export const PANEL = "rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6";
export const PANEL_INK = "rounded-3xl bg-[var(--m-ink)] p-5 text-white sm:p-6";
/** A page's grid: main column plus a 340px rail, the way Pulse lays out its feed. */
export const WITH_RAIL = "grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]";
export const H2 = "font-lp-display text-[22px] font-bold leading-tight tracking-tight text-[var(--m-ink)]";
export const H3 = "font-lp-display text-[17px] font-bold leading-snug text-[var(--m-ink)]";
export const MUTED = "text-[13.5px] leading-relaxed text-[var(--m-muted)]";
export const BTN = "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white transition-[background-color,transform] duration-200 hover:bg-[var(--m-accent-ink)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";
export const BTN_ACCENT = "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--m-accent)] px-5 py-2.5 text-[13.5px] font-bold text-white transition-[filter,transform] duration-200 hover:brightness-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none";
export const BTN_GHOST = "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--m-ink)] transition-[border-color,transform] duration-200 hover:border-[var(--m-ink)] active:scale-[0.97] motion-reduce:transition-none";
export const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
export const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";
