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

// Helper function to check if a value is a valid number (not NaN, not Infinity)
const isValidNumber = (value: any): value is number => {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
};

// Helper function to sanitize a number value
const sanitizeNumber = (value: any, fallback: number = 0): number => {
  return isValidNumber(value) ? value : fallback;
};

// Helper function to sanitize date string
const sanitizeDate = (dateStr: any): string => {
  if (typeof dateStr !== "string") return new Date().toISOString();

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return new Date().toISOString();

  return dateStr;
};

// Helper function to sanitize analytics data
const sanitizeAnalyticsData = (data?: AnalyticsData): AnalyticsData | null => {
  if (!data) return null;

  try {
    const sanitizedData: AnalyticsData = {
      totalConnects: sanitizeNumber(data.totalConnects),
      totalSubscribes: sanitizeNumber(data.totalSubscribes),
      totalMessages: sanitizeNumber(data.totalMessages),
      data: [],
    };

    if (Array.isArray(data.data)) {
      sanitizedData.data = data.data
        .map((item) => ({
          date: sanitizeDate(item.date),
          connect: sanitizeNumber(item.connect),
          subscribe: sanitizeNumber(item.subscribe),
          message: sanitizeNumber(item.message),
        }))
        .filter((item) => {
          // Filter out items with completely invalid data
          return item.connect >= 0 && item.subscribe >= 0 && item.message >= 0;
        });
    }

    return sanitizedData;
  } catch (error) {
    console.warn("Failed to sanitize analytics data:", error);
    return null;
  }
};

// Error boundary wrapper for chart rendering
class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("Chart rendering error:", error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-[250px]">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">
              Chart rendering failed
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function DashboardChartLineInteractive({
  analyticsData,
  isLoading = false,
}: DashboardChartLineInteractiveProps) {
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>("connect");
  const [hasError, setHasError] = React.useState(false);

  // Sanitize the analytics data
  const sanitizedData = React.useMemo(() => {
    return sanitizeAnalyticsData(analyticsData);
  }, [analyticsData]);

  const total = React.useMemo(() => {
    if (!sanitizedData) {
      return {
        connect: 0,
        subscribe: 0,
        message: 0,
      };
    }
    return {
      connect: sanitizedData.totalConnects,
      subscribe: sanitizedData.totalSubscribes,
      message: sanitizedData.totalMessages,
    };
  }, [sanitizedData]);

  const chartData = sanitizedData?.data || [];
  const hasSingleDataPoint = chartData.length === 1;
  const hasValidData = chartData.length > 0;

  // Handle error state
  if (hasError) {
    return (
      <Card className="py-4 sm:py-0">
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="text-center">
            <div className="text-muted-foreground mb-2">
              Failed to load analytics data
            </div>
            <button
              onClick={() => setHasError(false)}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="py-4 sm:py-0">
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="text-muted-foreground">Loading analytics data...</div>
        </CardContent>
      </Card>
    );
  }

  // Handle no data state
  if (!hasValidData) {
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
                    0
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <div className="text-muted-foreground">
            No analytics data available
          </div>
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
        <ChartErrorBoundary onError={() => setHasError(true)}>
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <LineChart
              accessibilityLayer
              data={chartData}
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
                minTickGap={hasSingleDataPoint ? 0 : 32}
                domain={hasSingleDataPoint ? ["dataMin", "dataMax"] : undefined}
                type={hasSingleDataPoint ? "number" : "category"}
                tickFormatter={(value) => {
                  try {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) return "";
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  } catch (error) {
                    console.warn("Date formatting error:", error);
                    return "";
                  }
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    nameKey="views"
                    labelFormatter={(value) => {
                      try {
                        const date = new Date(value);
                        if (isNaN(date.getTime())) return "Invalid date";
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                      } catch (error) {
                        console.warn("Tooltip date formatting error:", error);
                        return "Invalid date";
                      }
                    }}
                  />
                }
              />
              <Line
                dataKey={activeChart}
                type="monotone"
                stroke={`var(--color-${activeChart})`}
                strokeWidth={2}
                dot={
                  hasSingleDataPoint
                    ? {
                        fill: `var(--color-${activeChart})`,
                        strokeWidth: 2,
                        r: 4,
                      }
                    : false
                }
              />
            </LineChart>
          </ChartContainer>
        </ChartErrorBoundary>
      </CardContent>
    </Card>
  );
}
