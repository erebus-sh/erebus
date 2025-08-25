"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  Component,
  ErrorInfo,
} from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

import type {
  DashboardChartLineInteractiveProps,
  ChartKey,
  SinglePointDotProps,
  ErrorBoundaryProps,
  ErrorBoundaryState,
  Granularity,
} from "@/lib/chart/types";
import { sanitizeAnalyticsData } from "@/lib/chart/sanitizers";
import { formatChartTick, formatTooltipLabel } from "@/lib/chart/formatters";
import { processChartData, calculateTotals } from "@/lib/chart/utils";

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

// Error boundary wrapper for chart rendering
class ChartErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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
  onGranularityChange,
  onDateRangeChange,
}: DashboardChartLineInteractiveProps) {
  const [activeChart, setActiveChart] = useState<ChartKey>("connect");
  const [hasError, setHasError] = useState(false);

  const currentGranularity: Granularity = analyticsData?.granularity || "day";

  // Sanitize the analytics data
  const sanitizedData = useMemo(() => {
    const result = sanitizeAnalyticsData(analyticsData);
    console.log("Chart data processing:", {
      originalData: analyticsData,
      sanitizedData: result,
      hasData: result?.data && result?.data?.length > 0,
      sampleData: result?.data?.slice(0, 5),
      nonZeroData: result?.data?.filter(
        (d) => d.connect > 0 || d.subscribe > 0 || d.message > 0,
      ),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currentLocalTime: new Date().toLocaleString(),
    });
    return result;
  }, [analyticsData]);

  const total = useMemo(() => calculateTotals(sanitizedData), [sanitizedData]);

  const chartData = sanitizedData?.data || [];
  const hasSingleDataPoint = chartData.length === 1;
  const hasValidData = chartData.length > 0;

  // Process chart data for rendering
  const renderData = useMemo(() => {
    if (!sanitizedData) return [];
    return processChartData(chartData, sanitizedData);
  }, [chartData, sanitizedData]);

  // Custom dot that hides for synthetic points used to pad single-point series.
  const SinglePointDot = useCallback(
    (props: SinglePointDotProps): React.ReactElement<SVGElement> => {
      const { payload, cx, cy, index } = props;
      if (payload?.__synthetic) {
        // Return an empty SVG group with a key to avoid React key warnings.
        return <g key={index} />;
      }
      return (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r={5}
          stroke={`var(--color-${activeChart})`}
          strokeWidth={3}
          fill="hsl(var(--background))"
          className="drop-shadow-sm transition-all duration-200"
        />
      );
    },
    [activeChart],
  );

  // Handle error state
  if (hasError) {
    return (
      <Card className="py-4 sm:py-0 border-destructive/20">
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="text-center space-y-3">
            <div className="text-muted-foreground">
              Failed to load analytics data
            </div>
            <button
              onClick={() => setHasError(false)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
          <div className="text-center space-y-2">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
            <div className="text-muted-foreground text-sm">
              Loading analytics data...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle no data state
  if (!hasValidData) {
    return (
      <Card className="py-4 sm:py-0">
        <CardHeader className="flex flex-col items-stretch border-b !p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
              <CardTitle>Analytics Overview</CardTitle>
              <CardDescription>
                WebSocket connections, subscriptions, and messages over time
              </CardDescription>
            </div>

            {/* Granularity Toggle */}
            {onGranularityChange && (
              <div className="flex items-center gap-2 px-6 py-4 border-l border-border/50">
                <span className="text-sm text-muted-foreground font-medium">
                  View:
                </span>
                <div className="flex rounded-md border border-border overflow-hidden">
                  {(["day", "hour"] as const).map((granularity) => (
                    <button
                      key={granularity}
                      onClick={() => onGranularityChange(granularity)}
                      className={`
                        px-3 py-1.5 text-sm font-medium transition-colors
                        ${
                          currentGranularity === granularity
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }
                        ${granularity === "day" ? "" : "border-l border-border"}
                      `}
                    >
                      {granularity === "day" ? "Daily" : "Hourly"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex overflow-hidden rounded-lg border shadow-sm mx-6 mb-4">
            {["connect", "subscribe", "message"].map((key, idx, arr) => {
              const chart = key as keyof typeof chartConfig;
              const isActive = activeChart === chart;
              const isFirst = idx === 0;
              const isLast = idx === arr.length - 1;

              return (
                <button
                  key={chart}
                  data-active={isActive}
                  className={`
                    relative flex flex-1 flex-col justify-center gap-1.5 px-6 py-4 text-left
                    transition-all duration-200 ease-in-out
                    hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring/50
                    ${
                      isActive
                        ? "bg-muted/60 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }
                    ${!isFirst ? "border-l border-border/50" : ""}
                    ${isFirst ? "rounded-l-lg" : ""}
                    ${isLast ? "rounded-r-lg" : ""}
                    group
                  `}
                  onClick={() => setActiveChart(chart)}
                >
                  {/* Active indicator bar */}
                  <div
                    className={`
                    absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r transition-all duration-200
                    ${
                      isActive
                        ? "from-transparent via-primary to-transparent opacity-100"
                        : "opacity-0 group-hover:opacity-50"
                    }
                  `}
                  />

                  <span className="text-xs font-medium tracking-wide uppercase">
                    {chartConfig[chart].label}
                  </span>
                  <span
                    className={`
                    text-lg leading-none font-bold sm:text-3xl transition-colors duration-200
                    ${isActive ? "text-primary" : "text-foreground"}
                  `}
                  >
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
      <CardHeader className="flex flex-col items-stretch border-b !p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4">
            <CardTitle>Analytics Overview</CardTitle>
            <CardDescription>
              WebSocket connections, subscriptions, and messages over time
            </CardDescription>
          </div>

          {/* Granularity Toggle */}
          {onGranularityChange && (
            <div className="flex items-center gap-2 px-6 py-4 border-l border-border/50">
              <span className="text-sm text-muted-foreground font-medium">
                View:
              </span>
              <div className="flex rounded-md border border-border overflow-hidden">
                {(["day", "hour"] as const).map((granularity) => (
                  <button
                    key={granularity}
                    onClick={() => onGranularityChange(granularity)}
                    className={`
                      px-3 py-1.5 text-sm font-medium transition-colors
                      ${
                        currentGranularity === granularity
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }
                      ${granularity === "day" ? "" : "border-l border-border"}
                    `}
                  >
                    {granularity === "day" ? "Daily" : "Hourly"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex overflow-hidden rounded-lg border shadow-sm mx-6 mb-4">
          {["connect", "subscribe", "message"].map((key, idx, arr) => {
            const chart = key as keyof typeof chartConfig;
            const isActive = activeChart === chart;
            const isFirst = idx === 0;
            const isLast = idx === arr.length - 1;

            return (
              <button
                key={chart}
                data-active={isActive}
                className={`
                  relative flex flex-1 flex-col justify-center gap-1.5 px-6 py-4 text-left
                  transition-all duration-200 ease-in-out
                  hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring/50
                  ${
                    isActive
                      ? "bg-muted/60 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }
                  ${!isFirst ? "border-l border-border/50" : ""}
                  ${isFirst ? "rounded-l-lg" : ""}
                  ${isLast ? "rounded-r-lg" : ""}
                  group
                `}
                onClick={() => setActiveChart(chart)}
              >
                {/* Active indicator bar */}
                <div
                  className={`
                  absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r transition-all duration-200
                  ${
                    isActive
                      ? "from-transparent via-primary to-transparent opacity-100"
                      : "opacity-0 group-hover:opacity-50"
                  }
                `}
                />

                <span className="text-xs font-medium tracking-wide uppercase">
                  {chartConfig[chart].label}
                </span>
                <span
                  className={`
                  text-lg leading-none font-bold sm:text-3xl transition-colors duration-200
                  ${isActive ? "text-primary" : "text-foreground"}
                `}
                >
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
              data={renderData}
              margin={{
                left: 12,
                right: 12,
                top: 8,
                bottom: 8,
              }}
            >
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                minTickGap={32}
                type="category"
                tick={{
                  fontSize: 12,
                  fill: "hsl(var(--muted-foreground))",
                  fontWeight: 500,
                }}
                tickFormatter={(value) =>
                  formatChartTick({ value, granularity: currentGranularity })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, "dataMax + 1"]}
                allowDecimals={false}
                tick={{
                  fontSize: 12,
                  fill: "hsl(var(--muted-foreground))",
                  fontWeight: 500,
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[180px] border border-border/50 bg-background/95 backdrop-blur-sm shadow-lg"
                    nameKey="views"
                    labelFormatter={(value) =>
                      formatTooltipLabel({
                        value,
                        granularity: currentGranularity,
                      })
                    }
                  />
                }
                cursor={{
                  stroke: "hsl(var(--border))",
                  strokeWidth: 1,
                  strokeOpacity: 0.5,
                }}
              />
              <Line
                dataKey={activeChart}
                type="monotone"
                stroke={`var(--color-${activeChart})`}
                strokeWidth={3}
                dot={hasSingleDataPoint ? SinglePointDot : false}
                activeDot={{
                  r: 5,
                  stroke: `var(--color-${activeChart})`,
                  strokeWidth: 2,
                  fill: "hsl(var(--background))",
                  className: "drop-shadow-sm",
                }}
                style={{
                  filter: `drop-shadow(0 2px 4px var(--color-${activeChart})20)`,
                }}
              />
            </LineChart>
          </ChartContainer>
        </ChartErrorBoundary>
      </CardContent>
    </Card>
  );
}
