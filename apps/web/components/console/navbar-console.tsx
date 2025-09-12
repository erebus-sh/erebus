"use client";

import UserMenu from "@/components/navbar-components/user-menu";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LogoBare from "@/components/navbar-components/logo-bare";
import { useNavStackStore } from "@/stores/navigation";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "../ui/navigation-menu";
import SettingsMenu from "../navbar-components/settings-menu";
import Banner from "../Banner";

export default function NavbarConsole() {
  const { navStack, pushPage } = useNavStackStore();
  const params = useParams();
  const userSlug = params["user-slug"] as string;
  const projectSlug = params["proj-slug"] as string;
  const user = useQuery(api.users.query.getMeWithSubscription);
  const generateCustomerPortalUrl = useAction(
    api.polar.generateCustomerPortalUrl,
  );
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(
    null,
  );

  const navigationLinks = [
    { href: `/c/${userSlug}`, label: "Dashboard" },
    { href: process.env.NEXT_PUBLIC_DOCS_URL, label: "Docs" },
    { href: process.env.NEXT_PUBLIC_DOCS_URL + "/sdk", label: "SDK reference" },
  ];

  useEffect(() => {
    if (!userSlug) return;

    if (userSlug) {
      // Inital
      pushPage({
        label: "Personal Account",
        href: `/c/${userSlug}`,
      });
      pushPage({
        label: "Projects",
        href: `/c/${userSlug}/projects`,
      });
    }

    if (projectSlug) {
      pushPage({
        label: projectSlug,
        href: `/c/${userSlug}/projects/${projectSlug}`,
      });
    }

    (async () => {
      const result = await generateCustomerPortalUrl();
      setCustomerPortalUrl(result.url);
    })();

    // Only run on mount or when slug changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSlug, projectSlug]);

  return (
    <header className="border-b px-4 md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  className="text-foreground inline-block h-6 w-auto"
                >
                  <LogoBare />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator> / </BreadcrumbSeparator>
              <BreadcrumbItem className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger className="hover:text-foreground">
                    <BreadcrumbEllipsis />
                    <span className="sr-only">Toggle menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {navStack.map((item) => (
                      <DropdownMenuItem key={item.href}>
                        <BreadcrumbLink href={item.href}>
                          {item.label}
                        </BreadcrumbLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
              {navStack.map((item, index) => (
                <React.Fragment key={item.href}>
                  <BreadcrumbItem key={item.href}>
                    <BreadcrumbLink href={item.href}>
                      {item.label}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {index !== navStack.length - 1 && (
                    <BreadcrumbSeparator className="max-md:hidden">
                      {" "}
                      /{" "}
                    </BreadcrumbSeparator>
                  )}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Nav menu */}
            <NavigationMenu className="max-md:hidden">
              <NavigationMenuList className="gap-2">
                {navigationLinks.map((link, index) => (
                  <NavigationMenuItem key={index}>
                    <NavigationMenuLink
                      href={link.href}
                      className="text-muted-foreground hover:text-primary py-1.5 font-medium"
                    >
                      {link.label}
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
            {/* Settings */}
            <SettingsMenu />
          </div>
          {/* Note(#V0ID):Notification I have no point on using this for now
          <NotificationMenu /> */}
          {/* User menu */}
          <UserMenu
            user={{
              avatar: user?.image || "",
              name: user?.name || "",
              email: user?.email || "",
            }}
          />
        </div>
      </div>
      {!user?.isSubscribitionActive && (
        <Banner
          text="Your subscription has not been updated. Please check your details and try again."
          textLink="Subscribe"
          textLinkHref={customerPortalUrl!}
        />
      )}
    </header>
  );
}
