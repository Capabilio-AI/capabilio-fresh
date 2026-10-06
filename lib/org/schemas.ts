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

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));

/** A company visit: a company the college has confirmed will come to campus to hire. */
export const PlacementSchema = z
  .object({
    company: z.string().trim().min(1).max(200),
    // the role(s) being hired for, e.g. "Systems Engineer, Analyst"
    role: z.string().trim().min(1).max(200),
    location: optionalText(200),
    opportunityType: z.enum(["job", "internship"]),
    ctcOffered: optionalText(100),
    driveDate: dateOnly,
    deadline: dateOnly, // registration closes
    eligibleBranches: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    eligibility: optionalText(1000),
    status: z.enum(["planned", "registration_open"]).default("registration_open"),
  })
  .strict();

export const PostSchema = z
  .object({
    type: z.enum(["event", "announcement"]),
    // a LinkedIn-style post has no title: the server derives one from the text when none is given
    title: optionalText(200),
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
// logo and cover are set only by the upload route (never by a client-supplied URL)
export const ProfileSchema = z
  .object({
    tagline: optionalText(160),
    bio: optionalText(3000),
    websiteUrl: optionalUrl,
    foundedYear: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal("").transform(() => undefined)),
    city: optionalText(100),
    state: optionalText(100),
    /** unique per college; student roll numbers must start with it */
    collegeCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/, "Use 2–12 letters or digits.").optional().or(z.literal("").transform(() => undefined)),
    isPublic: z.boolean(),
  })
  .strict();
export const PostEditSchema = z.object({ postId: uuid, body: z.string().trim().min(1).max(5000) }).strict();
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
export const PlacementResponseSchema = z.object({ placementId: uuid, response: z.enum(["accepted", "declined"]) }).strict();
export const DRIVE_STATUSES = ["planned", "registration_open", "completed", "cancelled"] as const;
export const VisitStatusSchema = z.object({ opportunityId: uuid, status: z.enum(DRIVE_STATUSES) }).strict();
export const RsvpSchema = z.object({ postId: uuid, going: z.boolean() }).strict();

// ---- team & access ----
import { ALL_PERMISSION_KEYS, type OrgPermissionKey } from "./roles";
const permissionKey = z.enum(ALL_PERMISSION_KEYS as unknown as [OrgPermissionKey, ...OrgPermissionKey[]]);
export const InviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(["faculty", "hod", "tpo", "vice_principal"]),
    // null / omitted = the role's default set
    permissions: z.array(permissionKey).max(ALL_PERMISSION_KEYS.length).nullable().optional(),
  })
  .strict();
export const InviteIdSchema = z.object({ invitationId: uuid }).strict();
export const AcceptInviteSchema = z.object({ token: z.string().min(20).max(120), fullName: z.string().trim().min(2).max(120), password: z.string().min(8).max(200) }).strict();
export const MemberPermissionsSchema = z.object({ membershipId: uuid, permissions: z.array(permissionKey).max(ALL_PERMISSION_KEYS.length).nullable() }).strict();
export const MemberIdSchema = z.object({ membershipId: uuid }).strict();
export const JoinLinkSchema = z
  .object({
    label: optionalText(80),
    branch: optionalText(200),
    endYear: z.coerce.number().int().min(1980).max(2100).optional().or(z.literal("").transform(() => undefined)),
  })
  .strict();
export const JoinLinkToggleSchema = z.object({ linkId: uuid, active: z.boolean() }).strict();
