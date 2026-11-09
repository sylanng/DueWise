// server/src/services/retry.js
// Firestore sometimes fails for a moment (first request after idle, flaky Wi-Fi).
// Those errors are worth retrying; real mistakes (bad data, no permission) are not.

// gRPC codes: 4 = DEADLINE_EXCEEDED, 10 = ABORTED, 14 = UNAVAILABLE
const TRANSIENT_CODES = new Set([4, 10, 14]);
const TRANSIENT_TEXT =
  /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|Getting metadata from plugin failed|UNAVAILABLE|DEADLINE_EXCEEDED/i;

export function isTransient(err) {
  return TRANSIENT_CODES.has(err?.code) || TRANSIENT_TEXT.test(String(err?.message || ''));
}

// Only wrap calls that are safe to repeat (reads, and writes to a FIXED document id).
export async function withRetry(fn, { retries = 2, baseDelayMs = 300 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err;
      attempt += 1;
      console.warn(`Firestore call failed (${err.code ?? err.message}), retrying ${attempt}/${retries}`);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt * attempt)); // 300ms, 1200ms
    }
  }
}