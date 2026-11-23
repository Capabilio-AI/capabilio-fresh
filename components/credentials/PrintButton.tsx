"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog, where "Save as PDF" makes the certificate file. The page is styled for print. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white print:hidden">
      <Printer size={16} aria-hidden />Print or save as PDF
    </button>
  );
}
