import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProblemSection from "@/components/ProblemSection";
import ProductLoop from "@/components/ProductLoop";
import CareerPath from "@/components/CareerPath";
import Curriculum from "@/components/Curriculum";
import ProjectLab from "@/components/ProjectLab";
import DomainWorkspaces from "@/components/DomainWorkspaces";
import Arena from "@/components/Arena";
import Portfolio from "@/components/Portfolio";
import StudentJourney from "@/components/StudentJourney";
import Stakeholders from "@/components/Stakeholders";
import Pillars from "@/components/Pillars";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <Hero />
        <ProblemSection />
        <ProductLoop />
        <CareerPath />
        <Curriculum />
        <ProjectLab />
        <DomainWorkspaces />
        <Arena />
        <Portfolio />
        <StudentJourney />
        <Stakeholders />
        <Pillars />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
