import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import type { PropsWithChildren } from "react";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <HomeLayout {...baseOptions()}>
      {/* @ts-expect-error React type conflict between fumadocs-ui and local types */}
      {children}
    </HomeLayout>
  );
}
