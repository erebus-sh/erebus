"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexAuthClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}

const expiration = 20 * 60 * 1000; // 20 minutes

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthClientProvider>
        <ConvexQueryCacheProvider expiration={expiration}>
          <NuqsAdapter>{children}</NuqsAdapter>
        </ConvexQueryCacheProvider>
      </ConvexAuthClientProvider>
    </ConvexProvider>
  );
}
