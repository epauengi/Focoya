import { CtaSection } from "@/components/home/CtaSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { FooterSection } from "@/components/home/FooterSection";
import { HeroSection } from "@/components/home/HeroSection";
import { LogosSection } from "@/components/home/LogosSection";
import { ModesSection } from "@/components/home/ModesSection";
import { Navbar } from "@/components/home/Navbar";
import { PainTickerSection } from "@/components/home/PainTickerSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";

export function LandingPage() {
  return (
    <main className="focus-home">
      <Navbar />
      <HeroSection />
      <LogosSection />
      <FeaturesSection />
      <TestimonialsSection />
      <ModesSection />
      <PainTickerSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}

export default LandingPage;
