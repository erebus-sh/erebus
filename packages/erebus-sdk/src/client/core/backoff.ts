export function backoff(attempt: number, capMs = 5000): number {
  const base = 250 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 200);
  const delay = Math.min(capMs, base) + jitter;
  console.log("backoff computed", { attempt, capMs, base, jitter, delay });
  return delay;
}
