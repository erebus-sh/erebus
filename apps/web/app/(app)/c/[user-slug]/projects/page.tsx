import { redirect } from "next/navigation";

/**
 * This page is the root page for the projects page.
 * for now it will just redirect to the the root console page
 *
 * @returns
 */
export default function ProjectsPage() {
  return redirect("/c");
}
