import { cn } from "@/lib/utils";
import {
  Terminal,
  Shuffle,
  DollarSign,
  Cloud,
  Share2,
  HelpCircle,
  Zap,
  Heart,
} from "lucide-react";

export function FeaturesSection({ id }: { id: string }) {
  const features = [
    {
      title: "Open Source",
      description:
        "Erebus is fully open-source. You can read the code, self-host it, or just use it as is.",
      icon: <Terminal />,
    },
    {
      title: "Simple Setup",
      description:
        "Get started with just a few lines of code. No complex configs or heavy tooling.",
      icon: <Shuffle />,
    },
    {
      title: "Built for Real‑time",
      description:
        "Messaging and subscriptions that work out of the box. No extras, just the basics done right.",
      icon: <Cloud />,
    },
    {
      title: "For Developers",
      description:
        "Made for builders who want something lightweight, understandable, and easy to hack on.",
      icon: <Share2 />,
    },
    {
      title: "Transparent Pricing",
      description:
        "No hidden fees or surprises. Simple, honest pricing you can trust.",
      icon: <DollarSign />,
    },
    {
      title: "Community Support",
      description:
        "We don’t have 24/7 agents, but we do have docs, examples, and an open community.",
      icon: <HelpCircle />,
    },
    {
      title: "Lightweight by design",
      description:
        "Focused on the essentials of real‑time infra. No bloat, no big promises.",
      icon: <Zap />,
    },
    {
      title: "Still early",
      description:
        "This is an MVP. Expect rough edges, but it works — and will get better with time.",
      icon: <Heart />,
    },
  ];
  return (
    <section id={id} className="py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 max-w-7xl mx-auto">
        {features.map((feature, index) => (
          <Feature key={feature.title} {...feature} index={index} />
        ))}
      </div>
    </section>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r  py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800",
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
