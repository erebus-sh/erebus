"use client";

import { UsageTable } from "./components/usage-table";
import { useQueryWithState } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Spinner from "@/components/spinner";
import SidesLayout from "../components/sides-layout";
import { ChartBar } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function UsagePage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const [hasNewData, setHasNewData] = useState(false);

  // Track previous data to detect real-time updates
  const previousDataRef = useRef<string[]>([]);
  const PAGE_SIZE = 6;

  // Reset state when project changes
  useEffect(() => {
    setCursor(null);
    setCursorHistory([]);
    setHasNewData(false);
    previousDataRef.current = [];
  }, [projectSlug]);

  // Calculate current page position based on navigation state
  const currentPageNumber = cursorHistory.length + 1;
  const currentPageStart = (currentPageNumber - 1) * PAGE_SIZE + 1;

  const {
    data: usageData,
    isPending,
    isError,
  } = useQueryWithState(api.usage.query.getUsage, {
    projectSlug,
    paginationOpts: {
      numItems: PAGE_SIZE,
      cursor,
    },
  });

  // Detect real-time updates and handle them
  useEffect(() => {
    if (usageData?.page && usageData.page.length > 0) {
      const currentDataIds = usageData.page.map((item) => item._id);

      // Check if we have new data by comparing first item IDs
      if (previousDataRef.current.length > 0) {
        const hasNewItems = !previousDataRef.current.includes(
          currentDataIds[0],
        );

        if (hasNewItems && (cursor !== null || cursorHistory.length > 0)) {
          // New data arrived while not on first page - show notification
          setHasNewData(true);
        } else if (
          hasNewItems &&
          cursor === null &&
          cursorHistory.length === 0
        ) {
          // New data on first page - just update, no notification needed
          setHasNewData(false);
        }
      }

      // Update previous data reference
      previousDataRef.current = currentDataIds.slice(0, PAGE_SIZE);
    }
  }, [usageData?.page, cursor, cursorHistory.length]);

  // Limit displayed data to PAGE_SIZE to handle real-time updates
  const displayedData = usageData?.page
    ? usageData.page.slice(0, PAGE_SIZE)
    : [];

  const handleNextPage = () => {
    if (usageData?.continueCursor) {
      // Clear new data notification when navigating
      setHasNewData(false);
      // Always store the current cursor (or null for first page) before moving to next page
      setCursorHistory((prev) => [...prev, cursor]);
      setCursor(usageData.continueCursor);
    }
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length > 0) {
      // Get the previous cursor from history
      const previousCursor = cursorHistory[cursorHistory.length - 1];
      setCursor(previousCursor);
      // Remove the last cursor from history
      setCursorHistory((prev) => prev.slice(0, -1));
    } else {
      // Go back to first page
      setCursor(null);
    }
  };

  const handleGoToLatest = () => {
    // Reset to first page to see latest data
    setCursor(null);
    setCursorHistory([]);
    setHasNewData(false);
  };

  // canGoNext should be false if we've reached or passed the total count
  const canGoNext =
    usageData?.totalCount !== undefined &&
    displayedData &&
    currentPageStart + displayedData.length - 1 >= usageData.totalCount
      ? false
      : Boolean(usageData?.continueCursor && !usageData?.isDone);

  const canGoPrevious = cursor !== null || cursorHistory.length > 0;
  if (!usageData || displayedData.length === 0) {
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Usage</h1>
            {hasNewData && (
              <button
                onClick={handleGoToLatest}
                className="bg-zinc-800 hover:bg-zinc-900 text-zinc-100 text-sm px-3 py-1 rounded-md transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-zinc-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h8m-4-4l-4 4 4 4"
                  />
                </svg>
                Go to latest
              </button>
            )}
          </div>

          <UsageTable
            data={displayedData}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            isLoading={isPending}
            totalCount={usageData.totalCount}
            currentPageStart={currentPageStart}
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
