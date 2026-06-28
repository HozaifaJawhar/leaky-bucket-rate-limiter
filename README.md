Distributed Leaky Bucket Rate Limiter

A **leaky bucket** smooths bursty client traffic so a downstream service receives a
steady, predictable load. Requests are queued into a fixed-capacity bucket and
*leaked* (processed) at a constant rate. When the bucket is full, new requests are
rejected immediately with **HTTP 429**.

## Spec
| Parameter | Value |
| Capacity  | 6 buffered requests |
| Leak rate | 2 requests / second (steady) |
| Overflow  | HTTP 429 "Rate Limit Exceeded" |

## Run it
```bash
npm install

npm test           # deterministic unit tests (fake clock)
npm run demo       # prints buffering, steady draining, and 429s
npm run server     # HTTP gateway on :3000