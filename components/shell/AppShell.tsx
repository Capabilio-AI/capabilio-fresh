import type { ReactNode } from "react";
import { Topbar } from "@/components/shell/Topbar";
import { HeaderNav } from "@/components/shell/HeaderNav";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { MentorWidget } from "@/components/mentor/MentorWidget";
import { CallOverlay } from "@/components/messages/CallOverlay";
import { CallProvider } from "@/components/messages/CallProvider";
import { MessagingProvider } from "@/components/messages/MessagingProvider";
import "@/components/metro/metro.css";
import { metroFontVars } from "@/components/metro/font";
import { AreaMain } from "@/components/shell/AreaMain";
import { DirectionProvider } from "@/components/direction/DirectionContext";

export function AppShell({ viewer, banner, children }: { viewer: ViewerSummary; banner?: ReactNode; children: ReactNode }) {
  return (
    <DirectionProvider isJobTrack={viewer.direction?.track === "job"} launchpadOpen={viewer.direction?.launchpadOpen ?? false}>
      <MessagingProvider userId={viewer.id}>
      <CallProvider>
      <div className={`metro ${metroFontVars} min-h-screen bg-[var(--m-ground)]`}>
        <Topbar viewer={viewer} />
        <HeaderNav launchpadOpen={viewer.direction?.launchpadOpen ?? false} />
        <AreaMain>
          {banner}
          {children}
        </AreaMain>
        <MentorWidget />
      </div>
        <CallOverlay />
      </CallProvider>
      </MessagingProvider>
    </DirectionProvider>
  );
}
