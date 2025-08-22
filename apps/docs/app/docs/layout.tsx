import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";
import type { PropsWithChildren } from "react";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions()}>
      {/* @ts-expect-error React type conflict between fumadocs-ui and local types */}
      {children}
    </DocsLayout>
  );
}
