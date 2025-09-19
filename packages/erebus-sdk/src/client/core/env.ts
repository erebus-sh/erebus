export function isBrowser(): boolean {
  const hasWindow = typeof (globalThis as any).window !== "undefined"; // eslint-disable-line
  const hasDocument = typeof (globalThis as any).document !== "undefined"; // eslint-disable-line
  const result = hasWindow && hasDocument;
  console.log("env.isBrowser evaluated", { result });
  return result;
}

export function isProd(): boolean {
  try {
    const prod =
      typeof process !== "undefined" && process.env?.NODE_ENV === "production";
    console.log("env.isProd evaluated", { prod });
    return prod;
  } catch (err) {
    console.warn("env.isProd error", { err });
    return false;
  }
}
