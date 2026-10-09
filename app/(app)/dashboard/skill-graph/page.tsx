import { redirect } from "next/navigation";

/** The Skill Graph is now a section of Skills; old links keep working. */
export default function SkillGraphPage() {
  redirect("/dashboard/skills");
}
