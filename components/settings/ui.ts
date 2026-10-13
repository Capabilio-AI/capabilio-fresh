/** Shared class strings for the settings forms, in the student app's Metro tokens. */
export const INPUT =
  "w-full rounded-lg border border-[var(--m-rule)]! bg-[var(--m-sheet)] px-3.5 py-2.5 font-lp-body text-[14px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] transition-colors focus:border-[var(--m-accent-ink)]! focus:outline-none focus:ring-2 focus:ring-[var(--m-accent)]/25";

const BTN = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-lp-body text-[13px] font-bold transition-[background-color,opacity,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
export const BTN_PRIMARY = `${BTN} bg-[var(--m-ink)] text-[#fff] hover:opacity-90`;
export const BTN_QUIET = `${BTN} border border-[var(--m-rule)]! bg-[var(--m-sheet)] text-[var(--m-ink)] hover:bg-[var(--m-ground)]`;
export const BTN_DANGER = `${BTN} bg-[#b42318] text-[#fff] hover:bg-[#9a1d14]`;
