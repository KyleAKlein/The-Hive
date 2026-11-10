import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketTotals, moveBucketSats } from "../lib/live-buckets.ts";

const buckets = [
  { id: "savings", name: "Savings", sats: 2000 },
  { id: "habit", name: "Habit", sats: 0 },
];

test("reserving and releasing sats changes allocations without changing the wallet total", () => {
  const reserved = moveBucketSats(buckets, "habit", 500, "reserve", 3000);
  assert.deepEqual(bucketTotals(reserved, 3000), { reserved: 2500, available: 500, shortfall: 0 });
  const released = moveBucketSats(reserved, "habit", 500, "release", 0);
  assert.deepEqual(released, buckets);
});

test("reservations cannot exceed the wallet balance or release more than the bucket holds", () => {
  assert.throws(() => moveBucketSats(buckets, "habit", 1001, "reserve", 3000));
  assert.throws(() => moveBucketSats(buckets, "habit", 1.5, "reserve", 3000));
  assert.throws(() => moveBucketSats(buckets, "habit", 1, "release", 3000));
  assert.deepEqual(bucketTotals(buckets, 1500), { reserved: 2000, available: 0, shortfall: 500 });
  assert.throws(() => moveBucketSats(buckets, "habit", 1, "reserve", 1500));
});
