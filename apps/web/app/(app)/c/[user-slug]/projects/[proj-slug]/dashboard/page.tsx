"use client";

import { useState, useMemo } from "react";
import { DashboardChartLineInteractive } from "@/components/console/chart-line-interactive";
import SidesLayout from "../components/sides-layout";
import { useQueryWithState } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "lucide-react";

export default function DashboardPage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;
  const [granularity, setGranularity] = useState<"day" | "hour">("day");
  const [dateRange, setDateRange] = useState<{
    start: number;
    end: number;
  }>(() => {
    const now = Date.now();
    return {
      start: now - 30 * 24 * 60 * 60 * 1000, // Last 30 days
      end: now,
    };
  });
  const [selectedPreset, setSelectedPreset] = useState<string>("Last 30 days");

  // Date range presets
  const dateRangePresets = useMemo(() => {
    const now = Date.now();
    const presets = [
      {
        label: "Last 24 hours",
        value: "24h",
        range: { start: now - 24 * 60 * 60 * 1000, end: now },
        granularity: "hour" as const,
      },
      {
        label: "Last 7 days",
        value: "7d",
        range: { start: now - 7 * 24 * 60 * 60 * 1000, end: now },
        granularity: "day" as const,
      },
      {
        label: "Last 30 days",
        value: "30d",
        range: { start: now - 30 * 24 * 60 * 60 * 1000, end: now },
        granularity: "day" as const,
      },
      {
        label: "Last 90 days",
        value: "90d",
        range: { start: now - 90 * 24 * 60 * 60 * 1000, end: now },
        granularity: "day" as const,
      },
    ];
    return presets;
  }, []);

  const { data, isPending, error } = useQueryWithState(
    api.analytics.query.getAnalytics,
    {
      projectSlug: projectSlug,
      granularity,
      startTime: dateRange.start,
      endTime: dateRange.end,
    },
  );

  const handleGranularityChange = (newGranularity: "day" | "hour") => {
    setGranularity(newGranularity);
    // Adjust date range based on granularity
    const now = Date.now();
    if (newGranularity === "hour") {
      setDateRange({
        start: now - 24 * 60 * 60 * 1000, // Last 24 hours
        end: now,
      });
    } else {
      setDateRange({
        start: now - 30 * 24 * 60 * 60 * 1000, // Last 30 days
        end: now,
      });
    }
  };

  const handleDateRangeChange = (start: number, end: number) => {
    setDateRange({ start, end });
  };

  const handlePresetSelect = (preset: (typeof dateRangePresets)[0]) => {
    setDateRange(preset.range);
    setGranularity(preset.granularity);
    setSelectedPreset(preset.label);
  };

  if (error) {
    return (
      <SidesLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor your project's WebSocket connections, subscriptions, and
              messages
            </p>
          </div>

          <Card>
            <CardContent className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-3">
                <div className="text-destructive font-medium">
                  Failed to load analytics data
                </div>
                <div className="text-sm text-muted-foreground">
                  {error.message}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidesLayout>
    );
  }

  // Calculate summary metrics
  const summaryMetrics = data
    ? {
        totalConnections: data.totalConnects,
        totalSubscriptions: data.totalSubscribes,
        totalMessages: data.totalMessages,
        peakConnections: Math.max(...data.data.map((d) => d.connect), 0),
        peakSubscriptions: Math.max(...data.data.map((d) => d.subscribe), 0),
        peakMessages: Math.max(...data.data.map((d) => d.message), 0),
        avgConnectionsPerPeriod:
          data.data.length > 0
            ? Math.round(
                data.data.reduce((sum, d) => sum + d.connect, 0) /
                  data.data.length,
              )
            : 0,
        avgMessagesPerPeriod:
          data.data.length > 0
            ? Math.round(
                data.data.reduce((sum, d) => sum + d.message, 0) /
                  data.data.length,
              )
            : 0,
      }
    : null;

  return (
    <SidesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor your project's WebSocket connections, subscriptions, and
              messages
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {selectedPreset}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {dateRangePresets.map((preset) => (
                  <DropdownMenuItem
                    key={preset.value}
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary Cards */}
        {isPending ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-8 bg-muted animate-pulse rounded-full" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summaryMetrics ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Connections
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {granularity === "day" ? "30D" : "24H"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryMetrics.totalConnections.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak: {summaryMetrics.peakConnections.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Subscriptions
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {granularity === "day" ? "30D" : "24H"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryMetrics.totalSubscriptions.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak: {summaryMetrics.peakSubscriptions.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Messages
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {granularity === "day" ? "30D" : "24H"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryMetrics.totalMessages.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Peak: {summaryMetrics.peakMessages.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg. per {granularity}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Connections
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryMetrics.avgConnectionsPerPeriod}
                </div>
                <p className="text-xs text-muted-foreground">
                  Messages: {summaryMetrics.avgMessagesPerPeriod}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Main Chart */}
        <DashboardChartLineInteractive
          analyticsData={data}
          isLoading={isPending}
          onGranularityChange={handleGranularityChange}
          onDateRangeChange={handleDateRangeChange}
        />
      </div>
    </SidesLayout>
  );
}
