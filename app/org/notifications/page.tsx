import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { PageHeader } from "@/components/org/ui";
import { NotificationList } from "@/components/notifications/NotificationList";

export const metadata: Metadata = { title: "Notifications — Capabilio AI" };

export default async function OrgNotificationsPage() {
  await orgPageContext();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Notifications" subtitle="What has happened in your workspace: new registrations, submissions, applications and offers." />
      <NotificationList />
    </div>
  );
}
