import { redirect } from "next/navigation";

/** Renamed: staff, invitations and access now live under Team & access. */
export default function LegacyMembersPage() {
  redirect("/org/team");
}
