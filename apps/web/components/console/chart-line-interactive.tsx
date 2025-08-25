"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "An interactive line chart";

const chartConfig = {
  connect: {
    label: "Connections",
    color: "var(--chart-1)",
  },
  subscribe: {
    label: "Subscriptions",
    color: "var(--chart-2)",
  },
  message: {
    label: "Messages",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface AnalyticsData {
  data: Array<{
    date: string;
    connect: number;
    subscribe: number;
    message: number;
  }>;
  totalConnects: number;
  totalSubscribes: number;
  totalMessages: number;
}

interface DashboardChartLineInteractiveProps {
  analyticsData?: AnalyticsData;
  isLoading?: boolean;
}

export function DashboardChartLineInteractive({
  analyticsData,
  isLoading = false,
}: DashboardChartLineInteractiveProps) {
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>("connect");

  const total = React.useMemo(() => {
    if (!analyticsData) {
      return {
        connect: 0,
        subscribe: 0,
        message: 0,
      };
    }
    return {
      connect: analyticsData.totalConnects,
      subscribe: analyticsData.totalSubscribes,
      message: analyticsData.totalMessages,
    };
  }, [analyticsData]);

  if (isLoading) {
    return (
      <Card className="py-4 sm:py-0">
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="text-muted-foreground">Loading analytics data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>
            WebSocket connections, subscriptions, and messages over time
          </CardDescription>
        </div>
        <div className="flex">
          {["connect", "subscribe", "message"].map((key, idx, arr) => {
            const chart = key as keyof typeof chartConfig;
            // If this is the last item, add 'rounded-r-md' (right rounded corners)
            // and for the first item, add 'rounded-l-md' (left rounded corners)
            // If only one item, round both sides
            let roundedClass = "";
            if (idx === arr.length - 1) {
              roundedClass = "rounded-tr-md";
            }
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className={`data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6 ${roundedClass}`}
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-muted-foreground text-xs">
                  {chartConfig[chart].label}
                </span>
                <span className="text-lg leading-none font-bold sm:text-3xl">
                  {total[key as keyof typeof total].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={analyticsData?.data || []}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                />
              }
            />
            <Line
              dataKey={activeChart}
              type="monotone"
              stroke={`var(--color-${activeChart})`}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
