import type { OrgNavGroup } from "@/lib/org/nav";

/** The employer workspace's pages. Roles and campus visits are added here as they are built. */
export function companyNavGroups(): OrgNavGroup[] {
  return [{ label: "Workspace", items: [{ label: "Home", href: "/company" }, { label: "Roles", href: "/company/roles" }, { label: "Requests", href: "/company/requests" }, { label: "Messages", href: "/company/messages" }, { label: "Profile", href: "/company/profile" }, { label: "Posts", href: "/company/posts" }, { label: "Followers", href: "/company/followers" }] }];
}
