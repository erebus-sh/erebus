import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, ExternalLink } from "lucide-react";

const GithubIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 1024 1024"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"
      transform="scale(64)"
      fill="currentColor"
    />
  </svg>
);

const XIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 300 300.251"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
  >
    <path
      d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"
      fill="white"
    />
  </svg>
);

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Documentation", href: process.env.NEXT_PUBLIC_DOCS_URL || "#" },
    {
      label: "API Reference",
      href: `${process.env.NEXT_PUBLIC_DOCS_URL}/api` || "#",
    },
  ] as FooterLink[],
  resources: [
    {
      label: "GitHub",
      href: "https://github.com/erebus/erebus",
      external: true,
    },
    { label: "Discord", href: "#", external: true },
    { label: "Blog", href: "#", external: true },
    { label: "Status", href: "#", external: true },
  ] as FooterLink[],
  company: [
    { label: "About", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
  ] as FooterLink[],
};

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/erebus/erebus",
    icon: GithubIcon,
  },
  { label: "X", href: "#", icon: XIcon },
  { label: "Email", href: "mailto:hello@erebus.sh", icon: Mail },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="py-12 md:py-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand and description */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">
                    E
                  </span>
                </div>
                <span className="text-foreground font-mono font-bold text-lg">
                  Erebus
                </span>
              </div>
              <p className="text-muted-foreground mb-6 max-w-md font-mono text-sm leading-relaxed">
                Drop-in real-time messaging at the edge. Erebus runs your
                pub/sub backend on global infrastructure — fast, stateful, and
                dead simple.
              </p>

              {/* Social links */}
              <div className="flex gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <Button
                      key={social.label}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-accent"
                      asChild
                    >
                      <a
                        href={social.href}
                        target={
                          social.href.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          social.href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        aria-label={social.label}
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Links sections */}
            <div className="grid grid-cols-2 gap-8 lg:col-span-2">
              <div>
                <h3 className="text-foreground font-mono font-semibold mb-4 text-sm uppercase tracking-wider">
                  Product
                </h3>
                <ul className="space-y-3">
                  {footerLinks.product.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-primary font-mono text-sm transition-colors"
                        {...(link.external && {
                          target: "_blank",
                          rel: "noopener noreferrer",
                        })}
                      >
                        {link.label}
                        {link.external && (
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-foreground font-mono font-semibold mb-4 text-sm uppercase tracking-wider">
                  Resources
                </h3>
                <ul className="space-y-3">
                  {footerLinks.resources.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-primary font-mono text-sm transition-colors"
                        {...(link.external && {
                          target: "_blank",
                          rel: "noopener noreferrer",
                        })}
                      >
                        {link.label}
                        {link.external && (
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-border py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-muted-foreground font-mono text-sm">
              © {new Date().getFullYear()} Erebus. All rights reserved.
            </p>
            <div className="flex gap-6">
              {footerLinks.company.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-primary font-mono text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
