"use client";

import { useState } from "react";
import ProjectLayout from "./components/project-layout";
import { useNavStackStore } from "@/stores/navigation";
import { useSidebarStore } from "./store/sidebar";
import KeysPage from "./keys/page";
import UsagePage from "./usage/page";

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
      <div className="mt-8">{selectedItem === "keys" && <KeysPage />}</div>
      <div className="mt-8">{selectedItem === "usage" && <UsagePage />}</div>
    </ProjectLayout>
  );
}
