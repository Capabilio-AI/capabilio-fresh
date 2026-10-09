import { redirect } from "next/navigation";

/** SkillStudio is only the student's own career: this generic catalog was removed. Old links land on My Path. */
export default function Page() {
  redirect("/skillstudio");
}
