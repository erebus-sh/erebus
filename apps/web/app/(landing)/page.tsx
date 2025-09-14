import Navbar from "@/components/navbar";
import { FeaturesSection } from "./features";
import { Hero } from "./hero";
import { ErebusText } from "./erebus-text";
import Pricing from "./pricing";
import { Footer } from "./footer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <Hero id="home" />
        <FeaturesSection id="features" />
        <Pricing id="pricing" />
        <Link
          href="/pricing"
          className="text-muted-foreground w-full items-center flex justify-center gap-2 text-xs font-mono underline my-5"
        >
          View full feature comparison <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <Footer />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <ErebusText />
      </div>
    </main>
  );
}
