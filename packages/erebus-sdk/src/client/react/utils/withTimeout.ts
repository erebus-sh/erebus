import { ErebusError } from "@/service";

export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<{ value?: T; error?: Error }> {
  let timeoutId: ReturnType<typeof setTimeout>;
  let finished = false;

  return new Promise<{ value?: T; error?: Error }>((resolve) => {
    timeoutId = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve({
          error: new ErebusError(`${label} timeout after ${ms}ms`),
        });
      }
    }, ms);

    p.then(
      (v) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          resolve({ value: v });
        }
      },
      (e) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          // Wrap non-Error objects in an Error for type safety
          const error =
            e instanceof Error
              ? e
              : new ErebusError(
                  typeof e === "string"
                    ? e
                    : `Unknown error in ${label}: ${JSON.stringify(e)}`,
                );
          resolve({ error });
        }
      },
    );
  });
}
