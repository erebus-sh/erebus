export interface AnalyticsData {
  data: Array<{
    date: string;
    connect: number;
    subscribe: number;
    message: number;
  }>;
  totalConnects: number;
  totalSubscribes: number;
  totalMessages: number;
  granularity: "day" | "hour";
  timeRange: {
    start: number;
    end: number;
  };
}

export interface DashboardChartLineInteractiveProps {
  analyticsData?: AnalyticsData;
  isLoading?: boolean;
  onGranularityChange?: (granularity: "day" | "hour") => void;
  onDateRangeChange?: (startTime: number, endTime: number) => void;
}

export type ChartDataPoint = {
  date: string;
  connect: number;
  subscribe: number;
  message: number;
  __synthetic?: boolean;
};

export type ChartKey = "connect" | "subscribe" | "message";

export type Granularity = "day" | "hour";

export interface ChartConfig {
  connect: {
    label: string;
    color: string;
  };
  subscribe: {
    label: string;
    color: string;
  };
  message: {
    label: string;
    color: string;
  };
}

export interface SinglePointDotProps {
  payload?: ChartDataPoint;
  cx?: number;
  cy?: number;
  index?: number;
}

export interface ChartTooltipLabelFormatterProps {
  value: string | number;
  granularity: Granularity;
}

export interface ChartTickFormatterProps {
  value: string | number;
  granularity: Granularity;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
}
