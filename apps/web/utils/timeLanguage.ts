import { formatDistanceToNow, parseISO } from "date-fns";

export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? parseISO(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}
