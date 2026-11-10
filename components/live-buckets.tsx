"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bucketTotals, moveBucketSats, type LiveBucket, type LiveWalletSnapshot,
} from "@/lib/live-buckets";

function loadBuckets(key: string): LiveBucket[] {
  const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as LiveBucket[];
  if (!Array.isArray(saved) || saved.some((bucket) => !bucket ||
    typeof bucket.id !== "string" || typeof bucket.name !== "string" ||
    !Number.isSafeInteger(bucket.sats) || bucket.sats < 0
  ) || new Set(saved.map((bucket) => bucket.id)).size !== saved.length ||
    !Number.isSafeInteger(bucketTotals(saved, 0).reserved)) {
    throw new Error("Invalid bucket storage.");
  }
  return saved;
}

export default function LiveBuckets({ wallet, onBack }: {
  wallet: LiveWalletSnapshot;
  onBack: () => void;
}) {
  const key = `hive-live-buckets-v1:${wallet.identity}`;
  const [buckets, setBuckets] = useState<LiveBucket[] | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const totals = buckets && bucketTotals(buckets, wallet.balanceSats);

  useEffect(() => {
    function refresh() {
      try {
        setBuckets(loadBuckets(key));
      } catch {
        setBuckets(null);
        setStatus("This browser could not read your saved buckets.");
      }
    }
    function sync(event: StorageEvent) {
      if (event.key === key || event.key === null) refresh();
    }
    refresh();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);

  async function save(update: (current: LiveBucket[]) => LiveBucket[] | Promise<LiveBucket[]>) {
    if (busy || !buckets) return false;
    setBusy(true);
    setStatus("");
    try {
      if (!navigator.locks) {
        setStatus("This browser does not support safe bucket updates.");
        return false;
      }
      const next = await navigator.locks.request(key, async () => {
        const updated = await update(loadBuckets(key));
        localStorage.setItem(key, JSON.stringify(updated));
        return updated;
      });
      setBuckets(next);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The bucket change could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = name.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    if (await save((current) => {
      if (current.some((bucket) => bucket.name.toLowerCase() === label.toLowerCase())) {
        throw new Error("A bucket already uses that name.");
      }
      return [...current, { id, name: label, sats: 0 }];
    })) {
      setName("");
      setSelected(id);
      setStatus("Bucket created.");
    }
  }

  async function move(direction: "reserve" | "release") {
    const sats = /^\d+$/.test(amount) ? Number(amount) : 0;
    if (await save(async (current) => moveBucketSats(
      current, selected, sats, direction, direction === "reserve" ? await wallet.refreshBalance() : 0,
    ))) {
      setAmount("");
      setStatus(direction === "reserve" ? "Sats reserved." : "Sats released.");
    }
  }

  return (
    <div className="flow-screen tile-wallet-screen">
      <button className="back" onClick={onBack} disabled={busy} aria-label="Back to Hive"><ArrowLeft /></button>
      <h2>Bitcoin buckets</h2>
      <p className="flow-copy">{wallet.balanceSats.toLocaleString()} sats in your wallet</p>
      {totals && <p className="tile-wallet-total">
        {totals.available.toLocaleString()} sats available <span>· {totals.reserved.toLocaleString()} reserved</span>
      </p>}
      {!!totals?.shortfall && <p role="status" className="flow-copy">
        Reservations exceed the wallet balance by {totals.shortfall.toLocaleString()} sats. Release sats or add funds.
      </p>}
      <p className="flow-copy">Buckets are saved in this browser for this wallet. Sats stay in your wallet. Spending elsewhere can reduce the sats backing your buckets.</p>
      {buckets?.map((bucket) => <div className="lightning-transaction" key={bucket.id}>
        <span>{bucket.name}</span><b>{bucket.sats.toLocaleString()} sats</b>
      </div>)}
      <form className="invoice-form" onSubmit={createBucket}>
        <label>New bucket name<input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label>
        <Button disabled={busy || !buckets || !name.trim()}>Create bucket</Button>
      </form>
      {!!buckets?.length && <div className="invoice-form">
        <label>Bucket<select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose a bucket</option>
          {buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}
        </select></label>
        <label>Amount in sats<input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <Button disabled={busy || !selected || !amount} onClick={() => void move("reserve")}>Move sats into bucket</Button>
        <Button variant="outline" disabled={busy || !selected || !amount} onClick={() => void move("release")}>Release sats to spendable balance</Button>
      </div>}
      <p role="status" className="tile-notice">{status}</p>
    </div>
  );
}
