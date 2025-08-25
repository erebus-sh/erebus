"use client";

import { useState } from "react";
import ProjectLayout from "./components/project-layout";
import { useNavStackStore } from "@/stores/navigation";
import { useSidebarStore } from "./store/sidebar";
import KeysPage from "./keys/page";
import UsagePage from "./usage/page";
import DashboardPage from "./dashboard/page";

export default function ProjectsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentPath } = useNavStackStore();
  const { selectedItem } = useSidebarStore();
  return (
    <ProjectLayout
      currentPath={currentPath}
      mobileMenuOpen={mobileMenuOpen}
      setMobileMenuOpen={setMobileMenuOpen}
    >
      {["keys", "usage", "dashboard"].map((item) => {
        const PageComponent =
          item === "keys"
            ? KeysPage
            : item === "usage"
              ? UsagePage
              : DashboardPage;
        return (
          selectedItem === item && (
            <div className="mt-8" key={item}>
              <PageComponent />
            </div>
          )
        );
      })}
    </ProjectLayout>
  );
}
