# SE-4 — Distributed Leaky Bucket Rate Limiter

Intermediate task from the Distributed Systems Sandbox.

A **leaky bucket** smooths bursty client traffic so a downstream service receives a
steady, predictable load. Requests are queued into a fixed-capacity bucket and
*leaked* (processed) at a constant rate. When the bucket is full, new requests are
rejected immediately with **HTTP 429**.

## Spec
| Parameter | Value |
|-----------|-------|
| Capacity  | 6 buffered requests |
| Leak rate | 2 requests / second (steady) |
| Overflow  | HTTP 429 "Rate Limit Exceeded" |

## Leaky bucket vs. token bucket
- **Token bucket** accumulates tokens over time; a client can spend many at once,
  so the **output can be bursty** (good when short bursts are acceptable).
- **Leaky bucket** drains at a fixed rate regardless of input, so the **output is
  always smooth** — it trades burst tolerance for a perfectly stable downstream load.

## Run it
```bash
npm install        # installs tsx + typescript

npm test           # deterministic unit tests (fake clock)
npm run demo       # prints buffering, steady draining, and 429s
npm run server     # HTTP gateway on :3000

# hammer the server and watch 200s turn into 429s:
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" localhost:3000; done
```

## Files
- `src/security/LeakyBucketLimiter.ts` — the limiter (admission control + time-based leak).
- `src/security/LeakyBucketLimiter.test.ts` — unit tests with an injectable clock.
- `src/demo.ts` — bursty-traffic simulation.
- `src/server.ts` — HTTP gateway returning 200 / 429.

## Design notes
- The clock is injectable (`now()`), so the leak logic is tested deterministically
  without real `setTimeout` waits.
- Fractional leak amounts are carried between `leak()` calls (`leakCredit`) so the
  long-run drain rate is exactly 2/sec with no rounding drift.
- An idle, empty bucket does not bank drain credit — a leaky bucket has no burst
  allowance (that is the token bucket's job).
