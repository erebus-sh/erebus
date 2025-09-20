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
import { useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import Link from "next/link";
import { products } from "@/convex/products";
import { useQueryWithState } from "@/utils/query";
import { useRouter } from "next/navigation";

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
  productId?: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Pay-As-You-Go",
    price: "Usage-based",
    description: "Start small, scale as you need",
    features: [
      "50 projects",
      "Unlimited channels & topics",
      "Usage-based billing",
      "$5 free credit to get started",
    ],
    cta: { text: "Sign Up", variant: "secondary" },
    productId: products.freemium,
  },
  {
    name: "Standard",
    price: "$17",
    period: "/month",
    description: "For growing apps and indie projects",
    features: [
      "50 projects",
      "Unlimited channels & topics",
      "8.5M messages included / month",
      "Usage-based overages after that",
    ],
    cta: { text: "Get Started", variant: "default" },
    popular: true,
    productId: products.standard,
  },
  {
    name: "Pro",
    price: "$199",
    period: "/month",
    description: "For production apps at scale",
    features: [
      "50 projects",
      "Unlimited channels & topics",
      "Higher message limits",
      "Priority access to new features",
    ],
    cta: { text: "Coming Soon", variant: "outline" },
    highlight: true,
  },
];

export default function Pricing({ id }: { id: string }) {
  const router = useRouter();
  const generateCheckoutLinkAction = useAction(api.polar.generateCheckoutLink);
  const { data: user, isPending: isUserPending } = useQueryWithState(
    api.users.query.getMe,
  );
  const handleCheckout = useCallback(
    async (productId: string) => {
      if (!productId) {
        toast.error(
          "Pro is coming soon. Want early access or to discuss enterprise? Contact us!",
        );
        return;
      }

      if (isUserPending) {
        toast.error("Please wait and try again in a moment.");
        return;
      }

      if (!user) {
        toast.error("Please sign in or create an account to continue.");
        router.push("/sign-in?next=/pricing");
        return;
      }

      try {
        const checkoutLink = await generateCheckoutLinkAction({
          productIds: [productId],
          origin: window.location.origin,
          successUrl: window.location.origin + "/success?next=/c",
        });

        if (!checkoutLink.url) {
          toast.error(
            "Whoops! Something went wrong starting checkout. Please try again, and if it keeps failing, reach out—we’ll help you get sorted.",
          );
          return;
        }

        window.location.href = checkoutLink.url;
      } catch (error) {
        console.error("Failed to generate checkout link:", error);
        toast.error("Failed to start checkout process. Please try again.");
      }
    },
    [generateCheckoutLinkAction, user, isUserPending, router],
  );

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
                onClick={() => handleCheckout(tier.productId ?? "")}
              >
                {tier.cta.href ? (
                  <Link
                    href={tier.cta.href}
                    target={tier.cta.external ? "_blank" : undefined}
                    rel={tier.cta.external ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-center gap-2"
                  >
                    {tier.cta.text}
                    {tier.cta.external && <ExternalLink className="h-4 w-4" />}
                  </Link>
                ) : (
                  tier.cta.text
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground font-mono mt-4">
        Payments are processed via{" "}
        <Link
          href="https://polar.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Polar.sh
        </Link>
        .
      </p>

      <div className="text-center mt-12 space-y-4">
        <p className="text-muted-foreground text-sm">
          All plans include our core pub/sub messaging features. Enterprise
          plans include custom terms and conditions.
        </p>

        <div className="pt-4 border-t border-border/50">
          <p className="text-muted-foreground text-sm">
            Prefer to self-host? Erebus is proudly open-source!{" "}
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-muted-foreground hover:text-foreground underline-offset-4"
              asChild
            >
              <Link
                href="https://github.com/erebus-sh/erebus"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                View it on GitHub
                <ExternalLink className="h-2 w-2" />
              </Link>
            </Button>
          </p>
        </div>
      </div>
    </section>
  );
}
