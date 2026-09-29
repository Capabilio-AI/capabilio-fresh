import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ProjectStatusSchema } from "@/lib/org/schemas";
import { loadManagedProject } from "@/lib/org/project-access";
import { untyped } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, ProjectStatusSchema, "createProject", async ({ ctx, service }, body) => {
    if (!(await loadManagedProject(service, ctx, body.projectId))) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const { error } = await untyped(service).from("class_projects").update({ status: body.status }).eq("id", body.projectId);
    if (error) throw error;
    return {};
  });
}
