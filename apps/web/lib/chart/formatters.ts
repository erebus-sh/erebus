import type {
  Granularity,
  ChartTickFormatterProps,
  ChartTooltipLabelFormatterProps,
} from "./types";
import { parseISO, format, isValid as isValidDate } from "date-fns";

/**
 * Parses a date string/timestamp to a Date. Expects ISO UTC strings from server.
 */
export const convertToLocalDate = (dateInput: string | number): Date => {
  if (typeof dateInput === "number") {
    return new Date(dateInput);
  }
  const parsed = parseISO(dateInput);
  return isValidDate(parsed) ? parsed : new Date(NaN);
};

/**
 * Formats a date for chart display based on granularity
 */
export const formatChartDate = (
  dateInput: string | number | Date,
  granularity: Granularity,
): string => {
  const date =
    dateInput instanceof Date ? dateInput : convertToLocalDate(dateInput);

  if (!isValidDate(date)) return "";

  return granularity === "hour" ? format(date, "p") : format(date, "MMM d");
};

/**
 * Formats a date for tooltip display based on granularity
 */
export const formatTooltipDate = (
  dateInput: string | number | Date,
  granularity: Granularity,
): string => {
  const date =
    dateInput instanceof Date ? dateInput : convertToLocalDate(dateInput);
  if (!isValidDate(date)) return "Invalid date";

  return granularity === "hour"
    ? `${format(date, "MMM d, yyyy")} at ${format(date, "p")}`
    : format(date, "MMM d, yyyy");
};

/**
 * Parses a date value from various formats used in the chart
 * Handles UTC date strings from server and converts them to local time
 */
export const parseChartDateValue = (
  value: string | number,
  _granularity: Granularity,
): Date | null => {
  try {
    if (typeof value === "number") {
      return new Date(value);
    }
    const parsed = parseISO(value);
    return isValidDate(parsed) ? parsed : null;
  } catch (error) {
    console.warn("Date parsing error:", error, { value });
    return null;
  }
};

/**
 * Formats tick values for the chart X-axis
 */
export const formatChartTick = ({
  value,
  granularity,
}: ChartTickFormatterProps): string => {
  const date = parseChartDateValue(value, granularity);
  if (!date || isNaN(date.getTime())) return "";

  return formatChartDate(date, granularity);
};

/**
 * Formats tooltip labels for the chart
 */
export const formatTooltipLabel = ({
  value,
  granularity,
}: ChartTooltipLabelFormatterProps): string => {
  const date = parseChartDateValue(value, granularity);
  if (!date || isNaN(date.getTime())) return "Invalid date";

  return formatTooltipDate(date, granularity);
};

/**
 * Creates a formatted date string for synthetic data points in local timezone
 */
export const createSyntheticDateString = (
  date: Date,
  granularity: Granularity,
): string => {
  // Return ISO UTC at bucket start so the client consistently parses then formats locally
  const periodMs =
    granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const ms = date.getTime();
  const startMs = ms - (ms % periodMs);
  return new Date(startMs).toISOString();
};

/**
 * Creates a date string from timestamp in user's local timezone
 */
export const createLocalDateString = (
  timestamp: number,
  granularity: Granularity,
): string => {
  return createSyntheticDateString(new Date(timestamp), granularity);
};
