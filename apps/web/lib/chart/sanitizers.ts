import type { AnalyticsData, ChartDataPoint } from "./types";
import { parseISO, isValid as isValidDate } from "date-fns";

/**
 * Checks if a value is a valid number (not NaN, not Infinity)
 */
export const isValidNumber = (value: unknown): value is number => {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
};

/**
 * Sanitizes a number value with a fallback
 */
export const sanitizeNumber = (value: unknown, fallback = 0): number => {
  return isValidNumber(value) ? value : fallback;
};

/**
 * Sanitizes a date string and ensures it's in local timezone format
 */
export const sanitizeDate = (dateStr: unknown): string => {
  if (typeof dateStr !== "string") return new Date().toISOString();
  const parsed = parseISO(dateStr);
  if (!isValidDate(parsed)) return new Date().toISOString();
  // Normalize to ISO string to ensure consistent downstream parsing
  return parsed.toISOString();
};

/**
 * Sanitizes analytics data with comprehensive validation
 */
export const sanitizeAnalyticsData = (
  data?: AnalyticsData,
): AnalyticsData | null => {
  if (!data) return null;

  try {
    const sanitizedData: AnalyticsData = {
      totalConnects: sanitizeNumber(data.totalConnects),
      totalSubscribes: sanitizeNumber(data.totalSubscribes),
      totalMessages: sanitizeNumber(data.totalMessages),
      granularity: data.granularity || "day",
      timeRange: data.timeRange || { start: 0, end: Date.now() },
      data: [],
    };

    if (Array.isArray(data.data)) {
      sanitizedData.data = data.data
        .map(
          (item): ChartDataPoint => ({
            date: sanitizeDate(item.date),
            connect: sanitizeNumber(item.connect),
            subscribe: sanitizeNumber(item.subscribe),
            message: sanitizeNumber(item.message),
          }),
        )
        .filter((item) => {
          // Filter out items with completely invalid data or NaN values
          return (
            item.connect >= 0 &&
            item.subscribe >= 0 &&
            item.message >= 0 &&
            isValidNumber(item.connect) &&
            isValidNumber(item.subscribe) &&
            isValidNumber(item.message) &&
            item.date &&
            typeof item.date === "string"
          );
        })
        .sort((a, b) => {
          try {
            return parseISO(a.date).getTime() - parseISO(b.date).getTime();
          } catch {
            return 0;
          }
        });
    }

    return sanitizedData;
  } catch (error) {
    console.warn("Failed to sanitize analytics data:", error);
    return null;
  }
};
