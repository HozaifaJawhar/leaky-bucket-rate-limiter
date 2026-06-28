import { test } from "node:test";
import assert from "node:assert/strict";
import { LeakyBucketLimiter } from "./LeakyBucketLimiter.ts";

function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advanceMs: (ms: number) => {
      t += ms;
    },
  };
}

test("admits requests while there is room in the bucket", () => {
  const clock = fakeClock();
  const lb = new LeakyBucketLimiter({ capacity: 6, leakRatePerSec: 2, now: clock.now });
  for (let i = 0; i < 6; i++) {
    assert.equal(lb.tryAdmit().admitted, true, `request ${i} should be admitted`);
  }
  assert.equal(lb.getState().queueSize, 6);
});

test("rejects with 429 when the bucket overflows", () => {
  const clock = fakeClock();
  const lb = new LeakyBucketLimiter({ capacity: 6, leakRatePerSec: 2, now: clock.now });
  for (let i = 0; i < 6; i++) lb.tryAdmit();

  const overflow = lb.tryAdmit();
  assert.equal(overflow.admitted, false);
  assert.equal(overflow.status, 429);
  assert.equal(lb.getState().totalRejected, 1);
});

test("drains at a steady 2 requests/sec", () => {
  const clock = fakeClock();
  const lb = new LeakyBucketLimiter({ capacity: 6, leakRatePerSec: 2, now: clock.now });
  for (let i = 0; i < 6; i++) lb.tryAdmit();
  assert.equal(lb.getState().queueSize, 6);

  clock.advanceMs(1000);
  assert.equal(lb.leak(), 2);
  assert.equal(lb.getState().queueSize, 4);

  clock.advanceMs(500);
  assert.equal(lb.leak(), 1);
  assert.equal(lb.getState().queueSize, 3);
});

test("never exceeds capacity even under a heavy burst", () => {
  const clock = fakeClock();
  const lb = new LeakyBucketLimiter({ capacity: 6, leakRatePerSec: 2, now: clock.now });
  for (let i = 0; i < 50; i++) lb.tryAdmit();
  assert.equal(lb.getState().queueSize, 6);
  assert.equal(lb.getState().totalRejected, 44);
});

test("processes leaked requests via onProcess in FIFO order", () => {
  const clock = fakeClock();
  const processed: number[] = [];
  const lb = new LeakyBucketLimiter({
    capacity: 6,
    leakRatePerSec: 2,
    now: clock.now,
    onProcess: (r) => processed.push(r as number),
  });
  for (let i = 0; i < 4; i++) lb.tryAdmit(i);

  clock.advanceMs(1000);
  lb.leak();
  assert.deepEqual(processed, [0, 1]);
});

test("long-run drain rate is exact (no rounding drift)", () => {
  const clock = fakeClock();
  const lb = new LeakyBucketLimiter({ capacity: 100, leakRatePerSec: 2, now: clock.now });
  for (let i = 0; i < 100; i++) lb.tryAdmit();

  let leaked = 0;
  for (let i = 0; i < 50; i++) {
    clock.advanceMs(100);
    leaked += lb.leak();
  }
  assert.equal(leaked, 10);
});
