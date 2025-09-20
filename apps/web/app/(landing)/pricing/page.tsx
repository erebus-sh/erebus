import Navbar from "@/components/navbar";
import { ErebusText } from "../erebus-text";
import Pricing from "../pricing";
import { Footer } from "../footer";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessagesClientSide } from "./client-messages";

interface FeatureComparison {
  category: string;
  features: {
    name: string;
    payAsYouGo: boolean;
    standard: boolean;
    pro: boolean;
    description?: string;
  }[];
}

const featureComparison: FeatureComparison[] = [
  {
    category: "Core Features",
    features: [
      {
        name: "Open Source",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Full access to the source code",
      },
      {
        name: "Projects",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Up to 50 projects across all plans",
      },
      {
        name: "Channels & Topics",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Unlimited channels and topics",
      },
      {
        name: "Real-time Messaging",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Pub/sub system over WebSockets",
      },
    ],
  },
  {
    category: "Usage",
    features: [
      {
        name: "Included Messages",
        payAsYouGo: false, // usage-based only
        standard: true, // 8.5M bundled
        pro: true, // larger bundles
        description: "Messages included with each plan",
      },
      {
        name: "Overages",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Usage-based pricing beyond included quota",
      },
    ],
  },
  {
    category: "Support",
    features: [
      {
        name: "Community Support",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Docs, GitHub issues, discussions",
      },
      {
        name: "Email Support",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Direct support via email",
      },
    ],
  },
];

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <MessagesClientSide />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <Pricing id="pricing" />
        {/* Detailed feature comparison table */}
        <div className="w-full">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold tracking-tight mb-4">
              Feature Comparison
            </h3>
            <p className="text-muted-foreground">
              Compare all features across our pricing tiers
            </p>
          </div>

          <div className="w-full overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 bg-black">
              <div className="p-6 font-semibold text-zinc-50">Features</div>
              <div className="p-6 font-semibold text-center text-zinc-50 border-l border-y">
                Pay-As-You-Go
              </div>
              <div className="p-6 font-semibold text-center text-zinc-50 border-l border-y bg-zinc-800">
                Standard
                <span className="ml-3 text-xs bg-zinc-50 text-black px-3 py-1.5 rounded">
                  Popular
                </span>
              </div>
              <div className="p-6 font-semibold text-center text-zinc-50 border-l border-y">
                Pro
              </div>
            </div>

            {/* Feature categories */}
            {featureComparison.map((category, categoryIndex) => (
              <div key={category.category}>
                {/* Category header */}
                <div
                  className={cn(
                    "grid grid-cols-4 bg-zinc-900 border-b",
                    categoryIndex > 0 && "border-t",
                  )}
                >
                  <div className="p-4 font-medium text-sm text-zinc-50 leading-relaxed">
                    {category.category}
                  </div>
                  <div className="p-4 border-l border-y"></div>
                  <div className="p-4 border-l border-y bg-zinc-800"></div>
                  <div className="p-4 border-l border-y"></div>
                </div>

                {/* Features in category */}
                {category.features.map((feature, featureIndex) => (
                  <div
                    key={feature.name}
                    className={cn(
                      "grid grid-cols-4",
                      featureIndex % 2 === 0 ? "bg-black" : "bg-zinc-900",
                    )}
                  >
                    <div className="p-6 text-sm text-zinc-50 leading-relaxed">
                      <div className="font-medium mb-1">{feature.name}</div>
                      {feature.description && (
                        <div className="text-xs text-zinc-400 leading-relaxed">
                          {feature.description}
                        </div>
                      )}
                    </div>
                    <div className="p-6 text-center border-l flex items-center justify-center">
                      {feature.payAsYouGo ? (
                        <Check className="h-5 w-5 text-zinc-50" />
                      ) : (
                        <X className="h-5 w-5 text-zinc-500" />
                      )}
                    </div>
                    <div className="p-6 text-center border-l bg-zinc-900 flex items-center justify-center">
                      {feature.standard ? (
                        <Check className="h-5 w-5 text-zinc-50" />
                      ) : (
                        <X className="h-5 w-5 text-zinc-500" />
                      )}
                    </div>
                    <div className="p-6 text-center border-l flex items-center justify-center">
                      {feature.pro ? (
                        <Check className="h-5 w-5 text-zinc-50" />
                      ) : (
                        <X className="h-5 w-5 text-zinc-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 space-y-4">
          <p className="text-muted-foreground text-sm">
            All plans include our core pub/sub messaging features. Enterprise
            plans include custom terms and conditions.
          </p>
        </div>
      </div>
      <Footer />
      <div className="mx-4 sm:mx-6 md:mx-10 md:border-x md:border-[#232322] lg:mx-14">
        <ErebusText />
      </div>
    </main>
  );
}
