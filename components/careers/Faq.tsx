import { Plus } from "lucide-react";
import { FAQ } from "@/lib/hiring/content";

/** Native <details>: keyboard and screen-reader behaviour comes from the browser, and it works without JavaScript. */
export default function Faq() {
  return (
    <section id="faq" className="scroll-mt-14 px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[84rem] gap-12 lg:grid-cols-[1fr_1.6fr]">
        <h2 className="crit-head text-[clamp(2rem,4.6vw,3.6rem)]">Questions people ask.</h2>
        <div className="crit-schedule">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-[var(--crit-hair)]!">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="crit-head text-[1.25rem]">{f.q}</span>
                <Plus size={22} aria-hidden="true" className="shrink-0 transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="crit-body crit-soft max-w-2xl pb-6 text-[1.05rem] leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
