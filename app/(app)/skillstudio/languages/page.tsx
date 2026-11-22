import { redirect } from "next/navigation";

/** The language tracks now live inside Courses; old links and bookmarks land there. */
export default function Page() {
  redirect("/skillstudio/courses");
}
