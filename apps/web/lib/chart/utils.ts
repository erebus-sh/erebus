import type { AnalyticsData, ChartDataPoint, Granularity } from "./types";
import { createSyntheticDateString, convertToLocalDate } from "./formatters";
import { isValid as isValidDate } from "date-fns";

/**
 * Creates synthetic data points for single data point scenarios
 */
export const createSyntheticDataPoints = (
  originalPoint: ChartDataPoint,
  granularity: Granularity,
): ChartDataPoint[] => {
  // Expect ISO string from server and parse to Date (local rendering later)
  const baseDate = convertToLocalDate(originalPoint.date);

  // Validate that we got a valid date
  if (!isValidDate(baseDate)) {
    console.warn("Invalid base date for synthetic points:", originalPoint.date);
    return [originalPoint]; // Return original point if date is invalid
  }

  const periodMs =
    granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const prev = new Date(baseDate.getTime() - periodMs);
  const next = new Date(baseDate.getTime() + periodMs);

  const createPoint = (date: Date, isSynthetic = true): ChartDataPoint => ({
    date: createSyntheticDateString(date, granularity),
    connect: originalPoint.connect,
    subscribe: originalPoint.subscribe,
    message: originalPoint.message,
    __synthetic: isSynthetic,
  });

  return [
    createPoint(prev),
    { ...originalPoint, __synthetic: false },
    createPoint(next),
  ];
};

/**
 * Processes chart data for rendering, handling single points and synthetic data
 */
export const processChartData = (
  chartData: ChartDataPoint[],
  sanitizedData: AnalyticsData,
): ChartDataPoint[] => {
  const nonZeroCount = chartData.filter(
    (d) => d.connect > 0 || d.subscribe > 0 || d.message > 0,
  ).length;
  const total = {
    connect: sanitizedData.totalConnects,
    subscribe: sanitizedData.totalSubscribes,
    message: sanitizedData.totalMessages,
  };

  // TEMPORARY FIX: If we have total counts but no non-zero points in chart data,
  // create synthetic data points to show the totals
  if (
    nonZeroCount === 0 &&
    (total.connect > 0 || total.subscribe > 0 || total.message > 0)
  ) {
    const now = new Date();
    const bucketIso = createSyntheticDateString(now, sanitizedData.granularity);
    return [
      {
        date: bucketIso,
        connect: total.connect,
        subscribe: total.subscribe,
        message: total.message,
        __synthetic: false,
      },
    ];
  }

  // If we have multiple data points, return as-is
  if (chartData.length !== 1) return chartData;

  // If we have a single data point, pad with synthetic points
  return createSyntheticDataPoints(chartData[0], sanitizedData.granularity);
};

/**
 * Calculates totals from sanitized analytics data
 */
export const calculateTotals = (sanitizedData: AnalyticsData | null) => {
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
};

/**
 * Gets the current date in the user's local timezone
 */
export const getCurrentLocalDate = (): Date => {
  return new Date();
};

/**
 * Formats a relative time description (e.g., "2 hours ago", "in 3 days")
 */
export const formatRelativeTime = (timestamp: number): string => {
  // Validate timestamp
  if (!isValidDate(new Date(timestamp))) {
    return "invalid time";
  }

  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absDiff < minute) {
    return "just now";
  } else if (absDiff < hour) {
    const minutes = Math.floor(absDiff / minute);
    return diff > 0
      ? `in ${minutes} minute${minutes > 1 ? "s" : ""}`
      : `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else if (absDiff < day) {
    const hours = Math.floor(absDiff / hour);
    return diff > 0
      ? `in ${hours} hour${hours > 1 ? "s" : ""}`
      : `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else {
    const days = Math.floor(absDiff / day);
    return diff > 0
      ? `in ${days} day${days > 1 ? "s" : ""}`
      : `${days} day${days > 1 ? "s" : ""} ago`;
  }
};

/**
 * Checks if a timestamp represents today's date in local timezone
 */
export const isToday = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  if (!isValidDate(date)) return false;

  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * Checks if a timestamp represents yesterday's date in local timezone
 */
export const isYesterday = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  if (!isValidDate(date)) return false;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};
