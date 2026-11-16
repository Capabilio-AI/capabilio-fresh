import type { LegalSection } from "@/components/legal/LegalPage";

export const PRIVACY_UPDATED = "16 November 2026";

export const PRIVACY_INTRO =
  "This Privacy Policy explains how Capabilio AI (\"Capabilio\", \"we\", \"us\") collects, uses, shares, stores and protects personal data, and the rights you have over it. It is written to meet the Digital Personal Data Protection Act, 2023 (\"DPDP Act\"), the Information Technology Act, 2000 and the rules under it. By creating an account or using Capabilio you confirm that you have read it.";

export const PRIVACY_SUMMARY = [
  "We collect what we need to run your profile, assessments, skill record and applications, and nothing we have no use for.",
  "We do not sell your personal data, and we do not show advertising built on it.",
  "Your college and companies see only what the product's rules allow. Companies see what you choose to attach to an application.",
  "Tests are proctored: tab switches, full-screen exits and similar events are recorded and reported to your college.",
  "AI features send the content they work on (your answers, code, or resume text) to AI providers that process it for us.",
  "You can access, correct, download and erase your data, withdraw consent, and complain to us, and to the Data Protection Board of India if we do not resolve it.",
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Who is responsible for your data",
    body: [
      "For the data you give Capabilio when you create an account and use the service, Capabilio decides why and how it is processed, and is the \"Data Fiduciary\" under the DPDP Act. You are the \"Data Principal\".",
      "Where a college or company creates your record or uploads your details (for example a roll number or placement list), that organisation decides why that data is used and Capabilio processes it on the organisation's instructions. Questions about that use should also go to the organisation.",
      "This policy applies to the website, the web app, and every Capabilio feature, for students, graduates, working professionals, mentors, colleges and companies.",
    ],
  },
  {
    heading: "Personal data we collect",
    body: ["We collect the following, depending on how you use Capabilio."],
    items: [
      "Account data: name, email address, phone number where given, password credentials (stored only as a hash by our authentication provider), role (student, graduate, professional, college staff, company), and two-step verification settings.",
      "Education and career data: college, branch, years of study, roll number where your college provides it, career goals, chosen roles, resume contents and skills you add or confirm, work history and employer details for professionals.",
      "Assessment and learning data: your answers, scores, ratings, timing, skill estimates, Skill Passport and Skill Graph entries, projects, challenge attempts, course progress and feedback.",
      "Proctoring and integrity data: events recorded during tests, such as leaving full screen, switching tabs or windows, attempts to copy, paste, print or use developer tools, and when a test ended early. See section 5.",
      "Content you create: posts, comments, messages, mentoring requests and ratings, portfolio items, and files you upload such as resumes.",
      "Voice and calls: in the Speaking Studio your browser's speech recognition turns your voice into text, which is what we receive and send to AI for feedback; we do not receive the audio. In calls and sessions, audio and video go between participants through our real-time provider. We do not record calls.",
      "Connected accounts: if you connect GitHub for Code DNA, we read the public repository information you authorise. We never ask for your GitHub password.",
      "Technical data: sign-in times, IP address, device and browser type, pages visited, error logs and security events, used to run and protect the service.",
      "Information from others: your college or company may provide your details; mentors and mentees may rate each other.",
    ],
  },
  {
    heading: "Why we use your data, and the basis",
    body: [
      "We process personal data on the basis of your consent, given when you sign up and when you turn on a feature, and for the limited \"legitimate uses\" the DPDP Act allows, such as providing a service you asked for, keeping the service secure, complying with law, and responding to a medical or safety emergency.",
      "We use your data to: create and secure your account; run assessments and compute scores and ratings; build your Skill Passport, Skill Graph, roadmap and recommendations; show your profile to the people you choose; match you with roles and mentors; let colleges and companies work with each other on placements; run proctoring and detect cheating; send service messages and notifications; answer your requests; improve the product using aggregate or de-identified usage; and meet our legal obligations.",
      "We use your data only for these purposes. If we need to use it for a new purpose, we will ask you first where the law requires.",
      "You may withdraw consent at any time (section 12). Withdrawing does not make earlier processing unlawful, and some features cannot work without the data they need.",
    ],
  },
  {
    heading: "Who can see your data",
    body: ["What others see depends on your role and on choices you make."],
    items: [
      "You: all of your own data, from Settings and Privacy & data.",
      "Your college: only for its own students, only through pages its role permits. This can include your profile, assessment and Skill Passport results, attendance in college-run programmes, and integrity events from tests you took.",
      "Companies: only what you attach or allow when you apply to a role or accept a connection (for example your Skill Passport and chosen answers). Companies see followers by name only, never by email.",
      "Mentors and mentees: the profile and request details needed to run a mentoring session.",
      "Other users: whatever you post publicly (for example Pulse posts, a public profile or portfolio, a company page). Public content can be seen and copied by anyone.",
      "Capabilio staff: only those who need access to run, support and secure the service, under confidentiality duties and access controls.",
    ],
  },
  {
    heading: "Proctored tests and integrity data",
    body: [
      "Assessments, college exams and Arena challenges can run in a proctored mode. In that mode we record events such as full-screen exits, tab or window switches, attempts to copy, paste, print or open developer tools, and whether a test was ended early or automatically after repeated violations.",
      "Proctoring does not use your camera or microphone. We record events and counts, not your screen or your face.",
      "These events are used to judge whether a result is reliable, can lead to a test being ended or a result being marked, and are visible to your college and to Capabilio. A person, not only a program, reviews any action against your account.",
    ],
  },
  {
    heading: "AI features",
    body: [
      "Some features use AI models to generate questions, give feedback, build skill profiles, extract information from resumes or mark written and spoken answers. To do this we send the content a feature needs, such as your answer, code or resume text, to AI providers that process it for us.",
      "AI output can be wrong or incomplete. We design features so that scores and decisions that matter rely on stored, checked material and clear rules, and not on AI output alone. You should not treat AI feedback as professional advice.",
      "We do not sell this content and we do not allow providers to use it for advertising. We choose providers and settings that limit retention and further use of the content we send; some retention for abuse monitoring by a provider can still apply under its own terms.",
    ],
  },
  {
    heading: "Service providers and where data is processed",
    body: [
      "We use the following kinds of providers, who process personal data only to provide their service to us under written terms that require confidentiality and security:",
    ],
    items: [
      "Cloud database, authentication and file storage (Supabase).",
      "Application hosting and basic usage analytics (Vercel).",
      "AI model providers used for the features in section 6 (including Groq, Anthropic, Amazon Web Services Bedrock and providers reached through an OpenAI-compatible interface).",
      "Real-time voice and video for calls and sessions (LiveKit).",
      "Source-code and repository information when you connect it (GitHub).",
      "Email and notification delivery.",
    ],
  },
  {
    heading: "Transfers outside India",
    body: [
      "Some providers process data on servers outside India. We transfer personal data only where the DPDP Act and the rules under it allow, and we require the provider to protect it to a standard consistent with this policy. We do not transfer personal data to any country the Government of India has restricted.",
      "We do not share personal data with law enforcement or government unless a valid legal order or the law requires it, or to prevent serious harm.",
    ],
  },
  {
    heading: "How long we keep data",
    body: [
      "We keep personal data only as long as it is needed for the purpose it was collected for, or as the law requires.",
      "When you ask us to delete your account, or an organisation closes its workspace, we delete or anonymise the personal data within 30 days, except records we must keep by law, to detect fraud, or to establish or defend a legal claim. Encrypted backups roll off within 90 days.",
      "Results that colleges or companies have already received, and posts others have shared or copied, may remain with them under their own responsibility.",
      "Anonymised or aggregated information that can no longer identify you may be kept for analysis and product improvement.",
    ],
  },
  {
    heading: "Security",
    body: [
      "We apply reasonable security safeguards, including encryption in transit, encryption at rest by our database provider, row-level access control by role and organisation, rate limiting, optional two-step verification, logging of sensitive actions, and least-privilege access for our staff.",
      "If a personal data breach affects you, we will notify you and the Data Protection Board of India as the law requires, and describe what happened, what data was involved and what you can do.",
      "No system is perfectly secure. Keep your password private, turn on two-step verification, and tell us at once at the address in section 17 if you suspect misuse of your account.",
    ],
  },
  {
    heading: "Cookies and analytics",
    body: [
      "We use cookies and similar storage that are needed to keep you signed in, protect your session and remember your settings. We also use privacy-respecting usage analytics to count visits and find problems.",
      "We do not use advertising cookies, do not build advertising profiles, and do not track or monitor the behaviour of children for advertising.",
    ],
  },
  {
    heading: "Your rights",
    body: ["Under the DPDP Act you have the right to:"],
    items: [
      "Access: ask for a summary of the personal data we process about you and the processing we do with it.",
      "Correction and completion: correct inaccurate or incomplete data. Most details can be edited in Settings.",
      "Erasure: ask us to delete your personal data, subject to section 8.",
      "Withdraw consent: withdraw any consent you gave, as easily as you gave it.",
      "Grievance redressal: complain to us and get a reply (section 17).",
      "Nominate: name another person to exercise these rights if you die or cannot act.",
      "Download: export your data from Privacy & data in Settings.",
    ],
  },
  {
    heading: "Your duties",
    body: [
      "You must give accurate information, must not impersonate anyone, must not file false or frivolous complaints, and must not suppress material information when giving us data.",
    ],
  },
  {
    heading: "Children and minors",
    body: [
      "Capabilio is for people aged 16 and over. If you are under 18, you may use Capabilio only with the verifiable consent of your parent or lawful guardian, which we or your college may ask to see.",
      "We do not track or monitor the behaviour of children for advertising, and we do not process a child's data in a way likely to harm their well-being.",
      "If you believe a younger person has signed up or that a minor's data was collected without consent, tell us and we will act promptly.",
    ],
  },
  {
    heading: "No sale of data",
    body: [
      "We do not sell, rent or trade personal data. We do not share it with anyone for their own marketing.",
      "If Capabilio is merged with or acquired by another business, personal data may transfer to it, and we will tell you and require it to honour this policy.",
    ],
  },
  {
    heading: "Third-party links and content",
    body: [
      "Capabilio may link to other websites or let you open content from others. We are not responsible for their privacy practices. Read their policies before you share data with them.",
    ],
  },
  {
    heading: "Grievance Officer and how to complain",
    body: [
      "To exercise a right, ask a question or complain, write to our Grievance Officer at info@capabilio.online with the subject \"Privacy request\" and the email of your account. We may ask you to verify your identity before acting, to protect your data.",
      "We acknowledge a request within 3 working days and aim to resolve it within 30 days. If we need longer, we will tell you why.",
      "If we do not resolve your complaint, you may approach the Data Protection Board of India once it is constituted and the law allows.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We may update this policy. If a change materially affects how we process your data, we will tell you in the product or by email before it applies and, where the law requires, ask for your consent again. The date at the top shows the latest version. Continuing to use Capabilio after a change you were told about means you accept it.",
    ],
  },
  {
    heading: "Contact",
    body: ["Capabilio AI, info@capabilio.online. See also our Terms of Service, which apply together with this policy."],
  },
];
