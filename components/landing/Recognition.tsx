import Image from "next/image";

// Only recognitions Capabilio holds. Add the certificate / Udyam number once you have it; it is shown only when set.
export const RECOGNITIONS = [
  {
    key: "msme", logo: "/brand/recognition/msme.png", status: "Registered", title: "MSME Registered",
    body: "Registered as a Micro, Small & Medium Enterprise.", issuer: "Ministry of MSME, Govt. of India", pill: "MSME (Udyam) registered", number: "",
  },
  {
    key: "dpiit", logo: "/brand/recognition/startupindia.png", status: "Recognised", title: "Startup India",
    body: "Recognised as a startup by the Government of India.", issuer: "DPIIT, Ministry of Commerce & Industry", pill: "DPIIT recognised startup", number: "",
  },
];

export default function Recognition() {
  return (
    <section id="recognition" aria-labelledby="recognition-h" className="bg-cap-paper px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-[84rem]">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cap-orange">Trusted &amp; recognised</p>
          <h2 id="recognition-h" className="mt-3 font-cap-display text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-tight tracking-[-0.03em] text-cap-ink">
            Registered and recognised in India
          </h2>
        </div>
        <ul className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {RECOGNITIONS.map((r) => (
            <li key={r.key} className="flex flex-col rounded-2xl border border-cap-line! bg-white p-6 shadow-[0_1px_2px_rgba(12,16,32,0.04)] transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(12,16,32,0.18)]">
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-28 shrink-0 place-items-center rounded-xl border border-cap-line! bg-cap-mist p-1.5">
                  <Image src={r.logo} alt={`${r.title} logo`} width={160} height={160} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-cap-display text-xl font-semibold tracking-tight text-cap-ink">{r.title}</h3>
                  <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-cap-ok">
                    <span className="h-1.5 w-1.5 rounded-full bg-cap-ok" aria-hidden /> {r.status}
                  </span>
                </div>
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-cap-muted">{r.body}</p>
              <dl className="mt-5 grid gap-1 border-t border-cap-line! pt-4 text-sm">
                <dt className="text-xs uppercase tracking-wider text-cap-muted">Issued by</dt>
                <dd className="font-medium text-cap-ink">{r.issuer}</dd>
                {r.number && (<><dt className="mt-2 text-xs uppercase tracking-wider text-cap-muted">Certificate no.</dt><dd className="font-mono text-cap-ink">{r.number}</dd></>)}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
