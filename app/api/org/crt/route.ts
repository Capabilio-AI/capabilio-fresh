import { orgRoute } from "@/lib/api/org-route";
import { createCycle, CreateCycleSchema } from "@/lib/crt/org";

/** The placement cell schedules a CRT cycle. The college comes from the caller's membership, never the request. */
export async function POST(request: Request) {
  return orgRoute(request, CreateCycleSchema, "postPlacement", async ({ ctx, service }, body) => {
    const { id } = await createCycle(service, ctx.institutionId, ctx.userId, body);
    return { id };
  });
}
