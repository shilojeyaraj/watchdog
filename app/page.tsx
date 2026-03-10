import { HomeHero } from "@/components/home-hero";
import { Feature108 } from "@/components/blocks/feature108";
import { CreatedBySection } from "@/components/created-by-section";
import { ScrollNav } from "@/components/scroll-nav";

export default function Home() {
  return (
    <>
      <HomeHero />
      <Feature108 />
      <CreatedBySection />
      <ScrollNav />
    </>
  );
}
