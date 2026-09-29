import { redirect } from "next/navigation";

/** The curriculum tools now live inside the organisation workspace. Old links keep working. */
export default function LegacyAdminCurriculumPage() {
  redirect("/org/curriculum");
}
