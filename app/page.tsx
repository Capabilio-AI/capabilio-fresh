import { display } from "@/components/landing/fonts";
import "@/components/landing/landing.css";
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import EvidenceStrip from "@/components/landing/EvidenceStrip";
import Statement from "@/components/landing/Statement";
import WorldSays from "@/components/landing/WorldSays";
import Ecosystem from "@/components/landing/Ecosystem";
import Showcase from "@/components/landing/Showcase";
import Paths from "@/components/landing/Paths";
import Principles from "@/components/landing/Principles";
import Institutions from "@/components/landing/Institutions";
import Closing from "@/components/landing/Closing";
import CommandPalette from "@/components/landing/CommandPalette";

export default function Home() {
  return (
    <div className={`${display.variable} cap`}>
      <CommandPalette />
      <Nav />
      <main>
        <Hero />
        <EvidenceStrip />
        <Statement />
        <WorldSays />
        <Ecosystem />
        <Showcase />
        <Paths />
        <Principles />
        <Institutions />
        <Closing />
      </main>
    </div>
  );
}
