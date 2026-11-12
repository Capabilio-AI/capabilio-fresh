import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { PageHeader } from "@/components/org/ui";
import { NotificationList } from "@/components/notifications/NotificationList";

export const metadata: Metadata = { title: "Notifications — Company — Capabilio AI" };

export default async function CompanyNotificationsPage() {
  await orgPageContext();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Notifications" subtitle="New applications, followers and updates about your company." />
      <NotificationList />
    </div>
  );
}
