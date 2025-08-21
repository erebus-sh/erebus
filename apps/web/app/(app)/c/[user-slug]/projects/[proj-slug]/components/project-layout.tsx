"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PanelLeft,
  KeyIcon,
  BarChart3,
  FileText,
  Wifi,
  ChevronLeft,
  Info,
} from "lucide-react";
import { useSidebarStore } from "../store/sidebar";
import { useCallback } from "react";
import { useNavStackStore } from "@/stores/navigation";
import Link from "next/link";

interface ConsoleLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

interface SidebarItem {
  label: string;
  icon: React.ElementType;
  href: string;
  shortLabel: string;
  badge?: string;
}

const sidebarItems = [
  {
    label: "API Keys",
    icon: KeyIcon,
    shortLabel: "Keys",
    href: "/keys",
  },
  {
    label: "Usage",
    icon: BarChart3,
    shortLabel: "Usage",
    href: "/usage",
  },
  {
    label: "Logs",
    icon: FileText,
    shortLabel: "Logs",
    href: "/logs",
  },
  {
    label: "WebSocket Inspector",
    icon: Wifi,
    shortLabel: "WebSocket",
    href: "/websocket",
    badge: "Soon",
  },
];

export default function ProjectLayout({
  children,
  currentPath,
  mobileMenuOpen = false,
  setMobileMenuOpen,
}: ConsoleLayoutProps) {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    setSelectedItem,
    selectedItem,
  } = useSidebarStore();
  const { replacePage } = useNavStackStore();

  const handleNavClick = useCallback(
    (itemHref: SidebarItem) => {
      setSelectedItem(itemHref.shortLabel.toLowerCase());
      setMobileMenuOpen?.(false);
      replacePage(
        {
          label: itemHref.label,
          href: currentPath + itemHref.href,
        },
        true,
      );
    },
    [setSelectedItem, setMobileMenuOpen, replacePage, currentPath],
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen?.(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "bg-background flex flex-col border-r transition-all duration-300 ease-in-out",
          "md:relative",
          // Mobile styles
          "md:flex",
          mobileMenuOpen
            ? "fixed inset-y-0 left-0 z-50 w-64"
            : "hidden md:flex",
          // Desktop styles
          sidebarCollapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <h2 className="text-sm font-semibold">Console</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 p-0"
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = selectedItem === item.href;
            const isDisabled = item.badge === "Soon";

            return (
              <div key={item.href} className="relative">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    sidebarCollapsed ? "px-2" : "px-3",
                    isDisabled && "cursor-not-allowed opacity-50",
                  )}
                  disabled={isDisabled}
                  asChild={!isDisabled}
                >
                  {isDisabled ? (
                    <div>
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          sidebarCollapsed ? "mr-0" : "mr-3",
                        )}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span className="bg-muted ml-auto rounded-md px-1.5 py-0.5 text-xs">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div onClick={() => handleNavClick(item)}>
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          sidebarCollapsed ? "mr-0" : "mr-3",
                        )}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <span className="bg-muted ml-auto rounded-md px-1.5 py-0.5 text-xs">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Button>
              </div>
            );
          })}
        </nav>

        <div className="border-t p-4">
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <Link
                href="/feedback"
                className="w-fit text-xs font-medium text-zinc-500 flex items-center gap-1"
              >
                <Info className="h-3 w-3" />
                Share Feedback
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
