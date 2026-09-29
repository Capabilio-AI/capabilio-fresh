import { z } from "zod";

// Every body is strict(): institution, role, status, org type, user ids and team size are never accepted from a client.
const httpUrl = z.string().trim().max(2000).regex(/^https?:\/\/\S+$/, "Enter a full http(s) link.");
const optionalUrl = httpUrl.optional().or(z.literal("").transform(() => undefined));
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));
const uuid = z.string().uuid();

export const MATERIAL_TYPES = ["notes", "pdf", "link"] as const;
export const MaterialSchema = z
  .object({
    type: z.enum(MATERIAL_TYPES),
    title: z.string().trim().min(1).max(200),
    description: optionalText(2000),
    body: optionalText(20000),
    url: optionalUrl,
    subjectId: uuid.optional().or(z.literal("").transform(() => undefined)),
    branch: optionalText(200),
    year: z.coerce.number().int().min(1).max(6).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type === "notes" && !v.body) ctx.addIssue({ code: "custom", path: ["body"], message: "Notes need some text." });
    if (v.type !== "notes" && !v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Add a link." });
    if (!v.subjectId && (!v.branch || v.year === undefined)) ctx.addIssue({ code: "custom", path: ["branch"], message: "Pick a subject, or enter a branch and year." });
  });

export const ProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    brief: z.string().trim().min(1).max(10000),
    subjectId: uuid.optional().or(z.literal("").transform(() => undefined)),
    departmentScope: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
    submissionType: z.enum(["in_app", "physical"]),
    weeklyReportRequired: z.boolean(),
    deadlineAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  })
  .strict();

export const ProjectStatusSchema = z.object({ projectId: uuid, status: z.enum(["open", "closed", "archived"]) }).strict();
export const GroupCreateSchema = z.object({ projectId: uuid, name: z.string().trim().min(1).max(80) }).strict();
export const GroupIdSchema = z.object({ groupId: uuid }).strict();
export const ReportSchema = z
  .object({ groupId: uuid, weekNumber: z.coerce.number().int().min(1).max(52), content: z.string().trim().min(1).max(5000), attachmentUrl: optionalUrl })
  .strict();
export const SubmitSchema = z.object({ groupId: uuid, linkUrl: httpUrl }).strict();
export const GradeSchema = z
  .object({
    groupId: uuid,
    grade: z.string().trim().min(1).max(10),
    feedback: optionalText(5000),
    notes: z.record(uuid, z.string().trim().max(500)).optional(),
  })
  .strict();
export const FeedbackSchema = z.object({ reportId: uuid, feedback: z.string().trim().min(1).max(3000) }).strict();

export const PlacementSchema = z
  .object({
    role: z.string().trim().min(1).max(200),
    company: z.string().trim().min(1).max(200),
    location: optionalText(200),
    opportunityType: z.enum(["job", "internship"]),
    skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    eligibility: optionalText(1000),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  })
  .strict();

export const PostSchema = z
  .object({
    type: z.enum(["event", "announcement"]),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    coverImageUrl: optionalUrl,
    eventStartsAt: z.string().min(1).optional().or(z.literal("").transform(() => undefined)),
    eventLocation: optionalText(300),
    eventLink: optionalUrl,
    isPublic: z.boolean().default(false),
    publish: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.type !== "event" || Boolean(v.eventStartsAt), { path: ["eventStartsAt"], message: "Events need a start date and time." });
export const PostActionSchema = z.object({ postId: uuid, action: z.enum(["publish", "unpublish", "delete"]) }).strict();
export const ProfileSchema = z.object({ bio: optionalText(3000), coverImageUrl: optionalUrl, websiteUrl: optionalUrl, isPublic: z.boolean() }).strict();
export const MemberDecisionSchema = z.object({ membershipId: uuid, decision: z.enum(["approve", "reject"]) }).strict();
export const FollowSchema = z.object({ following: z.boolean() }).strict();
export const LikeSchema = z.object({ postId: uuid, liked: z.boolean() }).strict();

// ---- placement pipeline (docs/org-path-reference-study.md) ----
export const ApplySchema = z.object({ opportunityId: uuid }).strict();
export const APPLICATION_STATUSES = ["submitted", "shortlisted", "rejected", "accepted"] as const;
export const ApplicationStatusSchema = z.object({ applicationId: uuid, status: z.enum(APPLICATION_STATUSES) }).strict();
// A placement is confirmed either from a selected ('accepted') application, or directly for an off-campus offer.
export const ConfirmPlacementSchema = z
  .object({
    applicationId: uuid.optional(),
    studentUserId: uuid.optional(),
    company: optionalText(200),
    roleTitle: optionalText(200),
    ctcLpa: z.coerce.number().min(0).max(1000).optional().or(z.literal("").transform(() => undefined)),
    offerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.applicationId && !v.studentUserId) ctx.addIssue({ code: "custom", path: ["applicationId"], message: "Choose an application or a student." });
    if (!v.applicationId && (!v.company || !v.roleTitle)) ctx.addIssue({ code: "custom", path: ["company"], message: "Company and role are required." });
  });
export const PlacementConsentSchema = z.object({ placementId: uuid, show: z.boolean() }).strict();
export const RsvpSchema = z.object({ postId: uuid, going: z.boolean() }).strict();
