"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog, where "Save as PDF" turns the portfolio into a file. The page hides its menus when printing. */
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)] print:hidden"><Printer size={15} aria-hidden />Save as PDF</button>;
}
