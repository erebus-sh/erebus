import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import type { PropsWithChildren } from "react";

export default function Layout({ children }: PropsWithChildren) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
