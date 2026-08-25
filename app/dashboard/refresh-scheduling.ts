/**
 * Scheduling primitives for the dashboard refresh cycle.
 *
 * RC-3: every Kite call in the process is funnelled through one promise chain
 * with a 350 ms floor (`KITE_CALL_MIN_GAP_MS` in `kite-live-server.ts`). Firing
 * all non-selected sectors at once therefore does not make them arrive sooner —
 * it only queues dozens of per-constituent quote and history calls ahead of the
 * portfolio snapshot until Zerodha rate-limits, which then costs a 60 s penalty
 * (`markRateLimited`). Bounding client-side concurrency keeps the shared chain
 * available for the data the operator is actually looking at.
 */

/**
 * Run `tasks` with at most `limit` in flight, preserving result order.
 *
 * Never rejects: a failing task resolves to `null`, mirroring
 * `Promise.allSettled` semantics at the call sites this replaces.
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<Array<T | null>> {
  const results: Array<T | null> = new Array(tasks.length).fill(null);
  if (!tasks.length) return results;
  const ceiling = Math.max(1, Math.min(Math.floor(limit) || 1, tasks.length));
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      try {
        results[index] = await tasks[index]!();
      } catch {
        results[index] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: ceiling }, () => worker()));
  return results;
}

/**
 * Resolve once the browser is idle, so background sector loads never compete
 * with first paint. Falls back to a timeout where `requestIdleCallback` is
 * absent (Safari, and every non-browser test environment).
 */
export function whenIdle(timeoutMs = 2_000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    const idle = (window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof idle === "function") {
      idle(() => resolve(), { timeout: timeoutMs });
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

/**
 * RC-4: `refreshAll` used a bare `if (inFlight) return inFlight` guard that
 * ignored its own arguments, so a user-initiated forcing refresh was answered
 * with whatever background run happened to be executing. Because the native
 * launch path passes `silent: true` — which skips `setRefreshing(true)` — the
 * "Refresh all" button stayed enabled, and clicking it returned the running
 * non-forcing promise: no spinner, and Mail/Podcasts never force-refreshed.
 *
 * A request supersedes an in-flight one when it forces content that the running
 * pass did not, or when it is user-visible and the running pass is silent.
 */
export function supersedesInFlight(
  inFlight: { forceContent: boolean; silent: boolean },
  incoming: { forceContent: boolean; silent: boolean },
): boolean {
  if (incoming.forceContent && !inFlight.forceContent) return true;
  if (!incoming.silent && inFlight.silent) return true;
  return false;
}
