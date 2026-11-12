import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service — Capabilio AI", description: "The rules for using Capabilio AI as a student, college or company." };

const SECTIONS: LegalSection[] = [
  { heading: "Who these terms apply to", body: ["These terms apply to everyone who uses Capabilio AI: students, college staff and companies. By creating an account or using the service you agree to them. If you use Capabilio on behalf of a college or company, you confirm you are allowed to bind that organisation."] },
  { heading: "Accounts", body: ["Give accurate information and keep your sign-in details to yourself. You are responsible for what happens under your account, so turn on two-step verification in Settings. Tell us straight away if you think someone else has access.", "Colleges and companies are approved by Capabilio before their workspace opens. We may decline or remove an organisation that cannot show it is genuine."] },
  { heading: "What you may and may not do", body: ["Use Capabilio honestly. Do not impersonate a person or organisation, post false roles or offers, upload malware, scrape the service, probe it for weaknesses, or use it to harass anyone.", "Do not use candidate or student information for anything other than the purpose it was shared for, such as assessing an application or supporting a placement."] },
  { heading: "Companies, roles and applications", body: ["A company is responsible for the roles, posts and messages it publishes. Roles must be real, lawful and describe the job accurately. Do not charge candidates a fee to apply or to be hired.", "Applying to a role shares the Skill Passport and answers the student chose to attach with that company. A company may use them only to assess that application."] },
  { heading: "Colleges and student data", body: ["A college may open student records only through the pages its role allows and only for its own students. Administrators decide what each staff member can open."] },
  { heading: "Your content", body: ["You keep ownership of what you post. You give Capabilio a licence to host and display it so the service can work, for example showing a company post to its followers. Do not post anything you do not have the right to share."] },
  { heading: "Our service", body: ["Skill scores, assessments and suggestions are guidance, not a guarantee of any job or result. We work to keep Capabilio available and accurate but we provide it as is, and features may change.", "To the extent the law allows, Capabilio is not liable for indirect or consequential loss, or for decisions made by colleges, companies or students using the service."] },
  { heading: "Ending your use", body: ["You can stop using Capabilio at any time, and you can download your data from Settings. We may suspend or close an account that breaks these terms, with notice where that is practical."] },
  { heading: "Changes and governing law", body: ["We may update these terms. If a change matters, we will tell you in the product before it applies. These terms are governed by the laws of India, and the courts of India have jurisdiction, unless a mandatory law of your location says otherwise."] },
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated="3 November 2026" intro="Please read these terms. They explain what you can expect from Capabilio and what we expect from you." sections={SECTIONS} />;
}
