"use client";

import { UsageTable } from "./components/usage-table";
import { useQueryWithState } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Spinner from "@/components/spinner";
import SidesLayout from "../components/sides-layout";
import { ChartBar } from "lucide-react";
import { useState } from "react";

export default function UsagePage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const {
    data: usageData,
    isPending,
    isError,
  } = useQueryWithState(api.usage.query.getUsage, {
    projectSlug,
    paginationOpts: {
      numItems: 10,
      cursor,
    },
  });

  const handleNextPage = () => {
    if (usageData?.continueCursor) {
      setCursorHistory((prev) => [...prev, ...(cursor ? [cursor] : [])]);
      setCursor(usageData.continueCursor);
    }
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length > 0) {
      const previousCursor = cursorHistory[cursorHistory.length - 1];
      setCursor(previousCursor);
      setCursorHistory((prev) => prev.slice(0, -1));
    } else {
      setCursor(null);
    }
  };

  const canGoNext = Boolean(usageData?.continueCursor && !usageData?.isDone);
  const canGoPrevious = cursor !== null || cursorHistory.length > 0;
  if (!usageData || usageData.page.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        {isPending && <Spinner />}
        {!isPending && (
          <>
            <div className="bg-muted mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <ChartBar className="text-muted-foreground h-10 w-10 rotate-90 scale-x-[-1]" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">
              No usage data available
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              There haven&apos;t been any usage events for this project yet.
              Once your project starts generating activity, you&apos;ll see it
              here.
            </p>
            <div className="text-muted-foreground mt-8 text-xs">
              <p>
                Need assistance? Visit our{" "}
                <a
                  href={process.env.NEXT_PUBLIC_DOCS_URL}
                  className="hover:text-foreground underline"
                >
                  documentation
                </a>{" "}
                for guidance.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <SidesLayout>
      {isPending && <Spinner />}
      {!isPending && usageData && (
        <>
          <h1 className="text-2xl font-semibold mb-4">Usage</h1>

          <UsageTable
            data={usageData.page ?? []}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            isLoading={isPending}
          />
        </>
      )}
      {isError && (
        <div>
          Opss... Error loading usage events, if this continues, please contact
          support. hey@v0id.me
        </div>
      )}
    </SidesLayout>
  );
}
