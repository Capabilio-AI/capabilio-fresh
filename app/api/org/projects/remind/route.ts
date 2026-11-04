import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ProjectRemindSchema } from "@/lib/org/schemas";
import { loadManagedProject } from "@/lib/org/project-access";
import { loadProjectGroups } from "@/lib/org/loaders";
import { loadProjectProgress } from "@/lib/org/project-progress";
import { notify } from "@/lib/notifications/notify";
import { remindCopy } from "@/lib/org/project-notices";

/** Reminds every student in scope who has not joined a group. At most once a day per project (the notification key carries the date). */
export async function POST(request: Request) {
  return orgRoute(request, ProjectRemindSchema, "createProject", async ({ ctx, service }, body) => {
    const project = await loadManagedProject(service, ctx, body.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (project.status !== "open") return NextResponse.json({ error: "This project is closed." }, { status: 409 });
    const progress = await loadProjectProgress(service, project, await loadProjectGroups(service, project.id));
    const deadline = new Date(project.deadline_at).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
    const sent = await notify(service, { ...remindCopy(project.title, deadline), userIds: progress.notInGroupIds, type: "project_reminder", href: `/arena/projects/${project.id}`, actorId: ctx.userId, institutionId: ctx.institutionId, dedupeKey: `project-remind:${project.id}:${new Date().toISOString().slice(0, 10)}` });
    return { reminded: sent, waiting: progress.notInGroupTotal };
  });
}
