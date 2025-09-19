export function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    const parsed = JSON.parse(raw) as T;
    console.log("utils.safeJsonParse success");
    return parsed;
  } catch (err) {
    console.warn("utils.safeJsonParse failed", { err });
    return null;
  }
}
