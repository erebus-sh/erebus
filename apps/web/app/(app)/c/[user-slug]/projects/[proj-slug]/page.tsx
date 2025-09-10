"use client";

import { useState } from "react";
import ProjectLayout from "./components/project-layout";
import { useNavStackStore } from "@/stores/navigation";
import { useSidebarStore } from "./store/sidebar";
import KeysPage from "./keys/page";
import UsagePage from "./usage/page";
import DashboardPage from "./dashboard/page";
import AuditPage from "./audit/page";

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
      {["keys", "usage", "dashboard", "audit"].map((item) => {
        let PageComponent: React.ComponentType<any> | undefined;
        if (item === "keys") {
          PageComponent = KeysPage;
        } else if (item === "usage") {
          PageComponent = UsagePage;
        } else if (item === "dashboard") {
          PageComponent = DashboardPage;
        } else if (item === "audit") {
          PageComponent = AuditPage;
        } else {
          PageComponent = DashboardPage;
        }
        return (
          selectedItem === item && (
            <div className="mt-8" key={item}>
              {PageComponent && <PageComponent />}
            </div>
          )
        );
      })}
    </ProjectLayout>
  );
}
