import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = { title: "Entrepreneurship resources — Capabilio AI" };

// Informational only: static content, external links, no forms, nothing submitted anywhere.
const RESOURCES = [
  { name: "T-Hub", url: "https://t-hub.co", blurb: "A startup incubator and ecosystem enabler based in Hyderabad, Telangana." },
  { name: "Startup India", url: "https://www.startupindia.gov.in", blurb: "The Government of India's startup initiative — recognition, schemes and a directory of programs." },
  { name: "Atal Innovation Mission", url: "https://aim.gov.in", blurb: "Government of India programs that support innovation and incubation, including incubation centres." },
];

export default function EntrepreneurPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Entrepreneurship resources</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        A starting list of organisations that support early-stage founders in India. This is information only.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {RESOURCES.map((r) => (
          <li key={r.name} className="rounded-xl border border-app-border bg-white p-4">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">
              {r.name} <ExternalLink size={13} className="text-app-muted" />
            </a>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{r.blurb}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 rounded-lg border border-app-border bg-white px-4 py-3 font-lp-body text-[12.5px] text-app-muted">
        Capabilio has no partnership with these organisations and can&apos;t apply on your behalf. Eligibility, dates and programs change — check each official site for what&apos;s current. You can change your direction any time in{" "}
        <Link href="/settings/direction" className="text-app-blue hover:underline">Settings</Link>.
      </p>
    </div>
  );
}
