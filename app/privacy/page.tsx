import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — Capabilio AI", description: "What Capabilio AI collects, why, who sees it, and your rights." };

const SECTIONS: LegalSection[] = [
  { heading: "What we collect", body: ["Account details such as your name, email and role. For students: profile, assessments, projects, Skill Passport and applications. For colleges and companies: organisation details, posts, roles, followers and team information. We also keep basic technical data such as sign-in times, so we can keep accounts safe."] },
  { heading: "Why we use it", body: ["To run the service: sign you in, show your profile and page, match students with roles, and let colleges and companies work with each other. To keep it secure and prevent abuse. To improve the product using aggregate usage. We do not sell personal data."] },
  { heading: "Who can see what", body: ["Students choose what a company sees when they apply. Companies see followers by name only, never by email. College staff see only their own students, and only through the pages their role allows. Public pages, such as a company page and its posts, are visible to anyone."] },
  { heading: "Service providers", body: ["We use trusted providers to host the application, store data, send email and run AI features. They process data only to provide those services to us."] },
  { heading: "How long we keep it", body: ["We keep your data while your account is active. When an account or organisation is deleted we remove or anonymise its personal data, except where we must keep a record by law or to settle a dispute."] },
  { heading: "Security", body: ["Data is encrypted in transit. Access is limited by role and organisation, and you can protect your account with two-step verification. No system is perfectly secure, so tell us at once if you notice a problem."] },
  { heading: "Your rights", body: ["You can see and correct your details in Settings and download your data from Privacy & data. You can ask us to delete your account or to explain how your data is used. Write to us and we will reply within a reasonable time."] },
  { heading: "Children", body: ["Capabilio is for people aged 16 and over. If you believe a younger child has signed up, tell us and we will remove the account."] },
  { heading: "Changes", body: ["If we change this policy in a way that matters, we will tell you in the product before it applies."] },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="3 November 2026" intro="This explains what Capabilio AI collects, why, who can see it, and the choices you have." sections={SECTIONS} />;
}
