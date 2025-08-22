import Navbar from "@/components/navbar";
import { FeaturesSection } from "./features";
import { Hero } from "./hero";
import { ErebusText } from "./erebus-text";
import Pricing from "./pricing";
import { Footer } from "./footer";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <Hero id="home" />
        <FeaturesSection id="features" />
        <Pricing id="pricing" />
      </div>
      <Footer />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <ErebusText />
      </div>
    </main>
  );
}
