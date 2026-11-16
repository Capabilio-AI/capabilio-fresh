import { redirect } from "next/navigation";
import { keepProfessionalOut, requireRoleChosen } from "@/lib/stage/guard";

/** The Skill Graph is now a section of Skills; old links keep working. */
export default async function SkillGraphPage() {
  await keepProfessionalOut(); // not a professional's page
  await requireRoleChosen(); // a student who skipped the role has none of this
  redirect("/dashboard/skills");
}
