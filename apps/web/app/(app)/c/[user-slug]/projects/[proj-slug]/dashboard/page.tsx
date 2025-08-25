"use client";

import { DashboardChartLineInteractive } from "@/components/console/chart-line-interactive";
import SidesLayout from "../components/sides-layout";
import { useQueryWithStateCache } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";

export default function DashboardPage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;
  const { data, isPending, error } = useQueryWithStateCache(
    api.analytics.query.getAnalytics,
    {
      projectSlug: projectSlug,
    },
  );

  if (error) {
    return (
      <SidesLayout>
        <div className="flex items-center justify-center h-[300px] text-red-500">
          Error loading analytics data: {error.message}
        </div>
      </SidesLayout>
    );
  }

  return (
    <SidesLayout>
      <DashboardChartLineInteractive
        analyticsData={data}
        isLoading={isPending}
      />
    </SidesLayout>
  );
}
