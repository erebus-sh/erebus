import Navbar from "@/components/navbar";
import { FeaturesSection } from "./features";
import { Hero } from "./hero";
import { ErebusText } from "./erebus-text";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <Hero />
        <FeaturesSection />
        <ErebusText />
      </div>
    </main>
  );
}
