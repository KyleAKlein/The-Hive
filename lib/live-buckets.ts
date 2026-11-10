export type LiveBucket = { id: string; name: string; sats: number };

export type LiveWalletSnapshot = {
  identity: string;
  balanceSats: number;
  refreshBalance: () => Promise<number>;
};

export function bucketTotals(buckets: LiveBucket[], balanceSats: number) {
  const reserved = buckets.reduce((total, bucket) => total + bucket.sats, 0);
  return {
    reserved,
    available: Math.max(0, balanceSats - reserved),
    shortfall: Math.max(0, reserved - balanceSats),
  };
}

export function moveBucketSats(
  buckets: LiveBucket[],
  id: string,
  amount: number,
  direction: "reserve" | "release",
  balanceSats: number,
) {
  const bucket = buckets.find((item) => item.id === id);
  if (!bucket || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Choose a bucket and enter a whole number of sats.");
  }
  if (direction === "reserve" && (
    !Number.isSafeInteger(balanceSats) || amount > bucketTotals(buckets, balanceSats).available
  )) {
    throw new Error("Your wallet does not have that many unreserved sats.");
  }
  if (direction === "release" && amount > bucket.sats) {
    throw new Error("This bucket does not have that many reserved sats.");
  }

  const sats = bucket.sats + (direction === "reserve" ? amount : -amount);
  return buckets.map((item) => item.id === id ? { ...item, sats } : item);
}
