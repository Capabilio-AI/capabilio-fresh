import { Mail } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/site";
import ContactForm from "./ContactForm";

export default function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-h" className="border-t border-cap-line! bg-cap-mist px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto grid max-w-[84rem] gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cap-orange">Contact us</p>
          <h2 id="contact-h" className="mt-3 font-cap-display text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-tight tracking-[-0.03em] text-cap-ink">
            Questions? Write to us.
          </h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-cap-muted">
            Students, colleges and companies: tell us what you need and we will reply by email.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-7 inline-flex items-center gap-3 rounded-xl border border-cap-line! bg-white px-4 py-3 text-[15px] font-medium text-cap-ink transition-colors hover:border-cap-indigo!">
            <Mail size={18} className="text-cap-indigo" aria-hidden /> {CONTACT_EMAIL}
          </a>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
