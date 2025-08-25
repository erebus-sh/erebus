import type {
  Granularity,
  ChartTickFormatterProps,
  ChartTooltipLabelFormatterProps,
} from "./types";

/**
 * Converts a date string or timestamp to the user's local timezone
 */
export const convertToLocalDate = (dateInput: string | number): Date => {
  // If it's a string, try to parse it considering it might be in server timezone
  if (typeof dateInput === "string") {
    // Handle our custom format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
    if (dateInput.includes(" ") || dateInput.includes("-")) {
      // For date strings, assume they represent local dates and parse accordingly
      return new Date(
        dateInput + (dateInput.includes(" ") ? ":00" : "T00:00:00"),
      );
    }
    return new Date(dateInput);
  }

  // For timestamps, create Date object (automatically converts to local timezone)
  const localDate = new Date(dateInput);
  console.log("convertToLocalDate:", {
    input: dateInput,
    inputUTC: new Date(dateInput).toISOString(),
    outputLocal: localDate.toLocaleString(),
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return localDate;
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

  if (granularity === "hour") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    });
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
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

  if (granularity === "hour") {
    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " at " +
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      })
    );
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

/**
 * Parses a date value from various formats used in the chart
 * Handles UTC date strings from server and converts them to local time
 */
export const parseChartDateValue = (
  value: string | number,
  granularity: Granularity,
): Date | null => {
  try {
    if (typeof value === "number") {
      // Timestamps are already UTC, convert to local time
      return convertToLocalDate(value);
    }

    if (typeof value === "string") {
      // Handle both ISO strings and our custom format
      if (value.includes(" ") && granularity === "hour") {
        // Format: "2025-08-25 14:00" - this is UTC time from server, convert to local
        const [datePart, timePart] = value.split(" ");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour] = timePart.split(":").map(Number);

        // Create UTC date and then convert to local time
        const utcDate = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
        return convertToLocalDate(utcDate.getTime());
      } else if (value.includes("-") && !value.includes("T")) {
        // Format: "2025-08-25" - date only, assume UTC and convert to local
        const [year, month, day] = value.split("-").map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        return convertToLocalDate(utcDate.getTime());
      } else {
        // Standard date formats - use our conversion function
        return convertToLocalDate(value);
      }
    }

    return null;
  } catch (error) {
    console.warn("Date parsing error:", error, { value, granularity });
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
  // Date object is already in local time, no conversion needed
  const localDate = date;

  if (granularity === "hour") {
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    const hour = String(localDate.getHours()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:00`;
  } else {
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
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
