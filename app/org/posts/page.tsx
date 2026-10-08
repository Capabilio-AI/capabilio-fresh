import { redirect } from "next/navigation";

/** Posting now lives on the college page, so there is one place to post and one place to see it. */
export default function OrgPostsPage(): never {
  redirect("/org/college");
}
