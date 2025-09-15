import Navbar from "@/components/navbar";
import { ErebusText } from "../erebus-text";
import Pricing from "../pricing";
import { Footer } from "../footer";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InjectedMessagesClientSide } from "./injected-messages";

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
        description: "Full access to source code",
      },
      {
        name: "Real-time Messaging",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Pub/sub messaging system",
      },
      {
        name: "Simple Setup",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Quick integration with minimal config",
      },
      {
        name: "Lightweight Design",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Focused on essentials, no bloat",
      },
    ],
  },
  {
    category: "Scaling & Performance",
    features: [
      {
        name: "Auto-scaling (1K connections)",
        payAsYouGo: true,
        standard: false,
        pro: false,
        description: "Basic connection limits",
      },
      {
        name: "Auto-scaling (10K connections)",
        payAsYouGo: false,
        standard: true,
        pro: false,
        description: "Medium scale applications",
      },
      {
        name: "Auto-scaling (100K+ connections)",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Enterprise-grade scaling",
      },
      {
        name: "Load Balancing",
        payAsYouGo: false,
        standard: true,
        pro: true,
        description: "Distribute traffic across servers",
      },
      {
        name: "Custom Rate Limiting",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Fine-grained traffic control",
      },
    ],
  },
  {
    category: "Reliability & SLA",
    features: [
      {
        name: "Basic Uptime",
        payAsYouGo: true,
        standard: false,
        pro: false,
        description: "Best effort availability",
      },
      {
        name: "99.5% Uptime SLA",
        payAsYouGo: false,
        standard: true,
        pro: false,
        description: "Guaranteed service level",
      },
      {
        name: "99.9% Uptime SLA",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Premium service guarantee",
      },
      {
        name: "Message Retention (7 days)",
        payAsYouGo: true,
        standard: false,
        pro: false,
        description: "Standard message storage",
      },
      {
        name: "Message Retention (30 days)",
        payAsYouGo: false,
        standard: true,
        pro: false,
        description: "Extended message storage",
      },
      {
        name: "Unlimited Message Retention",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Keep messages forever",
      },
    ],
  },
  {
    category: "Monitoring & Analytics",
    features: [
      {
        name: "Basic Monitoring Dashboard",
        payAsYouGo: true,
        standard: false,
        pro: false,
        description: "Essential metrics tracking",
      },
      {
        name: "Advanced Monitoring & Alerts",
        payAsYouGo: false,
        standard: true,
        pro: true,
        description: "Comprehensive system monitoring",
      },
      {
        name: "Basic Analytics Dashboard",
        payAsYouGo: false,
        standard: true,
        pro: false,
        description: "Usage and performance insights",
      },
      {
        name: "Advanced Analytics & Insights",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Deep business intelligence",
      },
      {
        name: "Custom Reporting",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Tailored analytics reports",
      },
    ],
  },
  {
    category: "Support & Services",
    features: [
      {
        name: "Community Support",
        payAsYouGo: true,
        standard: true,
        pro: true,
        description: "Forum and documentation access",
      },
      {
        name: "Email Support",
        payAsYouGo: true,
        standard: false,
        pro: false,
        description: "Basic support channel",
      },
      {
        name: "Priority Email Support",
        payAsYouGo: false,
        standard: true,
        pro: false,
        description: "Faster response times",
      },
      {
        name: "Dedicated Support Manager",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Personal support contact",
      },
      {
        name: "SLA-based Support Response",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Guaranteed response times",
      },
    ],
  },
  {
    category: "Enterprise Features",
    features: [
      {
        name: "Custom Domain Support",
        payAsYouGo: false,
        standard: true,
        pro: true,
        description: "Use your own domain",
      },
      {
        name: "Custom Integrations",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Bespoke integration solutions",
      },
      {
        name: "Advanced Security Features",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Enhanced security controls",
      },
      {
        name: "Single Sign-On (SSO)",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Enterprise authentication",
      },
      {
        name: "Audit Logs",
        payAsYouGo: false,
        standard: false,
        pro: true,
        description: "Compliance and security tracking",
      },
    ],
  },
];

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <InjectedMessagesClientSide />
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
