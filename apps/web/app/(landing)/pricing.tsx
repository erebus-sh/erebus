"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink } from "lucide-react";

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: {
    text: string;
    href?: string;
    variant: "default" | "secondary" | "outline";
    external?: boolean;
  };
  popular?: boolean;
  highlight?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Pay-As-You-Go",
    price: "Usage-based",
    description: "Flexible pricing with $5 free credit",
    features: [
      "$5 free credit to get started",
      "Pay only for what you use",
      "Basic reliability features",
      "Email support",
      "Auto-scaling up to 1K connections",
      "Standard message retention (7 days)",
      "Basic monitoring dashboard",
    ],
    cta: {
      text: "Get Started",
      variant: "secondary",
    },
  },
  {
    name: "Standard",
    price: "$17",
    period: "/month",
    description: "Perfect for growing applications",
    features: [
      "Everything in Pay-As-You-Go",
      "99.5% uptime SLA",
      "Priority email support",
      "Auto-scaling up to 10K connections",
      "Extended message retention (30 days)",
      "Advanced monitoring & alerts",
      "Basic analytics dashboard",
      "Custom domain support",
    ],
    cta: {
      text: "Start Free Trial",
      variant: "default",
    },
    popular: true,
  },
  {
    name: "Pro",
    price: "$199",
    period: "/month",
    description: "For production applications at scale",
    features: [
      "Everything in Standard",
      "99.9% uptime SLA",
      "Dedicated support manager",
      "Auto-scaling up to 100K connections",
      "Unlimited message retention",
      "Advanced analytics & insights",
      "Custom integrations",
      "SLA-based support response",
      "Custom rate limiting",
      "Advanced security features",
    ],
    cta: {
      text: "Coming Soon",
      variant: "outline",
    },
    highlight: true,
  },
];

export default function Pricing({ id }: { id: string }) {
  return (
    <section id={id} className="py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold tracking-tight mb-4">
          Choose Your Plan
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          From self-hosted solutions to enterprise-grade reliability, we have a
          plan that fits your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.name}
            className="relative h-full transition-all duration-200 hover:shadow-lg"
          >
            {tier.popular && (
              <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-secondary text-secondary-foreground">
                Most Popular
              </Badge>
            )}

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-semibold">
                {tier.name}
              </CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold">{tier.price}</span>
                {tier.period && (
                  <span className="text-muted-foreground ml-1">
                    {tier.period}
                  </span>
                )}
              </div>
              <CardDescription className="mt-2">
                {tier.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter className="pt-6">
              <Button
                variant={tier.cta.variant}
                className="w-full"
                asChild={!!tier.cta.href}
              >
                {tier.cta.href ? (
                  <a
                    href={tier.cta.href}
                    target={tier.cta.external ? "_blank" : undefined}
                    rel={tier.cta.external ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-center gap-2"
                  >
                    {tier.cta.text}
                    {tier.cta.external && <ExternalLink className="h-4 w-4" />}
                  </a>
                ) : (
                  tier.cta.text
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="text-center mt-12 space-y-4">
        <p className="text-muted-foreground text-sm">
          All plans include our core pub/sub messaging features. Enterprise
          plans include custom terms and conditions.
        </p>

        <div className="pt-4 border-t border-border/50">
          <p className="text-muted-foreground text-sm">
            Prefer to self-host? Erebus is open-source.{" "}
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-muted-foreground hover:text-foreground underline-offset-4"
              asChild
            >
              <a
                href="https://github.com/erebus/erebus"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                View it on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </p>
        </div>
      </div>
    </section>
  );
}
