import { orgRoute } from "@/lib/api/org-route";
import { JoinRequestIdSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** A student withdraws their own pending request. */
export async function POST(request: Request) {
  return orgRoute(request, JoinRequestIdSchema, "joinGroup", async ({ ctx, service }, body) => {
    const { error } = await untyped(service).rpc("class_cancel_join_request", { p_user_id: ctx.userId, p_request_id: body.requestId });
    if (error) throw error;
    return {};
  });
}
