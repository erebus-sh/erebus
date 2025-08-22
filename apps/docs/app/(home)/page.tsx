/**
 * No need for a home page, redirect to docs immediately
 */
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/docs");
}
