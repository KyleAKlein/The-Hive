"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  BreezSdk,
  GetInfoResponse,
  Payment,
  SdkEvent,
} from "@breeztech/breez-sdk-spark/ssr";
import { QRCodeSVG } from "qrcode.react";
import {
  checkRecovery,
  connectHiveWallet,
  createRecovery,
  HIVE_LIGHTNING_ENABLED,
  normalizeRecovery,
  usdToSats,
} from "@/lib/hive-wallet";
import {
  clearRecoveryFromDevice,
  loadRecoveryFromDevice,
  saveRecoveryToDevice,
} from "@/lib/local-wallet-vault";

type Phase = "restore" | "preparing" | "backup" | "fund" | "active";

function isCompletedFundingPayment(payment: Payment, invoice: string) {
  return Boolean(
    invoice &&
      payment.paymentType === "receive" &&
      payment.status === "completed" &&
      payment.details?.type === "lightning" &&
      payment.details.invoice.toLowerCase() === invoice.toLowerCase(),
  );
}

const REFRESH_EVENTS = new Set<SdkEvent["type"]>([
  "synced",
  "unclaimedDeposits",
  "claimedDeposits",
  "newDeposits",
  "paymentPending",
  "paymentSucceeded",
  "paymentFailed",
]);

export default function HiveWallet({
  intent,
  initialRecovery,
  backupRequest,
  onConnectionChange,
  onBack,
  onOpenApp,
  onFundingComplete,
}: {
  intent: "join" | "restore" | null;
  initialRecovery: string;
  backupRequest: number;
  onConnectionChange: (connected: boolean) => void;
  onBack: () => void;
  onOpenApp: () => void;
  onFundingComplete: () => void;
}) {
  const seed = useRef("");
  const sdk = useRef<BreezSdk | null>(null);
  const listenerId = useRef<string | null>(null);
  const operationLocked = useRef(false);
  const copiedRecovery = useRef("");
  const fundingInvoiceRef = useRef("");
  const [phase, setPhase] = useState<Phase>("restore");
  const [recovery, setRecovery] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [backupSaved, setBackupSaved] = useState(false);
  const [info, setInfo] = useState<GetInfoResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [unclaimedSats, setUnclaimedSats] = useState(0);
  const [bitcoinAddress, setBitcoinAddress] = useState("");
  const [sparkAddress, setSparkAddress] = useState("");
  const [lightningAmount, setLightningAmount] = useState("");
  const [lightningNote, setLightningNote] = useState("");
  const [lightningInvoice, setLightningInvoice] = useState("");
  const [fundingInvoice, setFundingInvoice] = useState("");
  const [fundingSats, setFundingSats] = useState(0);
  const [fundingUsdRate, setFundingUsdRate] = useState(0);
  const [fundingFeeSats, setFundingFeeSats] = useState(0);
  const [fundingPaid, setFundingPaid] = useState(false);

  useEffect(() => {
    if (intent === "join" && !seed.current) {
      seed.current = initialRecovery ? checkRecovery(initialRecovery) : createRecovery();
      setPhase("preparing");
      setStatus("Securing your new wallet on this browser before creating the funding QR…");
      void connectAndOpen(seed.current, "fund", true);
    } else if (intent === "restore" && !seed.current) {
      setPhase("preparing");
      setStatus("Checking this browser for your saved wallet…");
      void openSavedWallet();
    }
  }, [initialRecovery, intent]);

  useEffect(() => {
    if (!backupRequest || !seed.current) return;
    setRecovery(seed.current);
    setBackupSaved(false);
    setPhase("backup");
    setStatus("Your 12-word wallet backup is ready.");
  }, [backupRequest]);

  useEffect(
    () => () => {
      const client = sdk.current;
      const activeListener = listenerId.current;
      seed.current = "";
      if (!client) return;
      void (async () => {
        if (activeListener) await client.removeEventListener(activeListener).catch(() => false);
        await client.disconnect().catch(() => undefined);
      })();
    },
    [],
  );

  async function run(task: () => Promise<void>) {
    if (operationLocked.current) return;
    operationLocked.current = true;
    setBusy(true);
    try {
      await task();
    } catch {
      setStatus(
        "The wallet operation could not be completed. Your recovery words have not changed. Check the connection and try again.",
      );
    } finally {
      operationLocked.current = false;
      setBusy(false);
    }
  }

  async function refreshWallet(client: BreezSdk) {
    const [walletInfo, history, unclaimed] = await Promise.all([
      client.getInfo({ ensureSynced: false }),
      client.listPayments({ limit: 20, assetFilter: { type: "bitcoin" } }),
      client.listUnclaimedDeposits({}),
    ]);
    if (sdk.current !== client) return;
    setInfo(walletInfo);
    setPayments(history.payments);
    const fundingConfirmed = history.payments.some((payment) =>
      isCompletedFundingPayment(payment, fundingInvoiceRef.current),
    );
    if (fundingConfirmed) {
      setFundingPaid(true);
      setStatus("Funding payment confirmed by Breez.");
    }
    setUnclaimedCount(unclaimed.deposits.length);
    setUnclaimedSats(
      unclaimed.deposits.reduce((total, deposit) => total + deposit.amountSats, 0),
    );
    return fundingConfirmed;
  }

  async function createFundingInvoice(client: BreezSdk) {
    setPhase("fund");
    setFundingInvoice("");
    fundingInvoiceRef.current = "";
    setFundingPaid(false);
    setStatus("Getting a current $5 Bitcoin quote…");
    const { rates } = await client.listFiatRates();
    const usd = rates.find((rate) => rate.coin.toUpperCase() === "USD");
    if (!usd || !Number.isFinite(usd.value) || usd.value <= 0) {
      throw new Error("The current Bitcoin price is unavailable.");
    }
    const amountSats = usdToSats(5, usd.value);
    const result = await client.receivePayment({
      paymentMethod: {
        type: "bolt11Invoice",
        amountSats,
        description: "Join The Hive · $5 wallet funding",
        expirySecs: 3600,
      },
    });
    fundingInvoiceRef.current = result.paymentRequest;
    setFundingInvoice(result.paymentRequest);
    setFundingSats(amountSats);
    setFundingUsdRate(usd.value);
    setFundingFeeSats(Number(result.fee));
    setStatus("Your real Lightning funding invoice is ready for one hour.");
  }

  async function disconnectWallet() {
    const client = sdk.current;
    const activeListener = listenerId.current;
    listenerId.current = null;
    sdk.current = null;
    if (!client) return;
    if (activeListener) await client.removeEventListener(activeListener).catch(() => false);
    await client.disconnect().catch(() => undefined);
    onConnectionChange(false);
  }

  function resetWalletState() {
    seed.current = "";
    setRecovery("");
    setConfirmation("");
    setBackupSaved(false);
    setInfo(null);
    setPayments([]);
    setUnclaimedCount(0);
    setUnclaimedSats(0);
    setBitcoinAddress("");
    setSparkAddress("");
    setLightningAmount("");
    setLightningNote("");
    setLightningInvoice("");
    fundingInvoiceRef.current = "";
    setFundingInvoice("");
    setFundingSats(0);
    setFundingUsdRate(0);
    setFundingFeeSats(0);
    setFundingPaid(false);
    setPhase("restore");
  }

  async function lockWallet() {
    await run(async () => {
      await disconnectWallet();
      resetWalletState();
      setStatus("Wallet locked. Reopen it from this browser or use your saved recovery words.");
    });
  }

  async function leaveWallet() {
    if (phase === "backup") {
      setRecovery("");
      setBackupSaved(false);
      if (sdk.current) setPhase("active");
      setStatus("");
      onBack();
      return;
    }
    if (phase === "fund") {
      onBack();
      return;
    }
    await run(async () => {
      await disconnectWallet();
      resetWalletState();
      setStatus("");
      onBack();
    });
  }

  async function copy(value: string, message = "Copied.") {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message);
    } catch {
      setStatus("Clipboard unavailable. Select the text and copy it manually.");
    }
  }

  async function pasteRecovery() {
    let value = "";
    try {
      value = await navigator.clipboard.readText();
    } catch {
      value = copiedRecovery.current;
    }
    if (!value.trim()) value = copiedRecovery.current;
    if (!value.trim()) {
      setStatus("Click in the box and press Ctrl+V, or press and hold and choose Paste.");
      return;
    }
    setConfirmation(normalizeRecovery(value));
    setStatus("Recovery words pasted. Tap Open my wallet.");
  }

  async function connectWallet(mnemonic: string, destination: "active" | "fund") {
    seed.current = mnemonic;
    setStatus("Opening your Bitcoin wallet…");
    const connected = await connectHiveWallet(mnemonic);
    sdk.current = connected;
    try {
      listenerId.current = await connected.addEventListener({
        onEvent(event) {
          if (event.type === "paymentSucceeded" && isCompletedFundingPayment(event.payment, fundingInvoiceRef.current)) {
            setFundingPaid(true);
            setStatus("Funding payment confirmed by Breez.");
          }
          if (REFRESH_EVENTS.has(event.type) && sdk.current === connected) {
            void refreshWallet(connected).catch(() => undefined);
          }
        },
      });
      await refreshWallet(connected);
    } catch {
      await disconnectWallet();
      throw new Error("wallet sync");
    }
    setConfirmation("");
    setRecovery("");
    setStatus("Bitcoin wallet connected.");
    onConnectionChange(true);
    if (destination === "fund") {
      await createFundingInvoice(connected);
    } else {
      setPhase("active");
      onOpenApp();
    }
  }

  async function connectAndOpen(
    words: string,
    destination: "active" | "fund" = "active",
    persistUntilBackup = false,
  ) {
    let mnemonic: string;
    try {
      mnemonic = checkRecovery(words);
    } catch {
      setStatus("Those recovery words are not valid. Check the spelling and order.");
      return;
    }
    await run(async () => {
      if (persistUntilBackup) await saveRecoveryToDevice(mnemonic);
      await connectWallet(mnemonic, destination);
    });
  }

  async function openSavedWallet() {
    await run(async () => {
      const saved = await loadRecoveryFromDevice();
      if (!saved) {
        setPhase("restore");
        setStatus("No unfinished wallet is saved on this browser. Paste your recovery words below.");
        return;
      }
      await connectWallet(saved, "active");
    });
  }

  async function finishBackup() {
    if (sdk.current) {
      await clearRecoveryFromDevice().catch(() => undefined);
      setRecovery("");
      setBackupSaved(false);
      setPhase("active");
      setStatus("Wallet backup saved.");
      onOpenApp();
      return;
    }
    await connectAndOpen(seed.current, intent === "join" ? "fund" : "active");
  }

  const field = (label: string, element: ReactNode) => (
    <label>
      {label}
      {element}
    </label>
  );
  const hasSession = Boolean(seed.current);

  return (
    <div className="hive-wallet lightning-wallet">
      <button disabled={busy} onClick={leaveWallet} className="hive-wallet-back">
        {phase === "backup" ? "← My Cell" : "← Welcome"}
      </button>
      <p className="step">
        {phase === "backup"
          ? "WALLET BACKUP · MY CELL"
          : phase === "preparing"
            ? "CREATING YOUR WALLET"
          : phase === "fund"
            ? "STEP 2 OF 3 · FUND"
          : phase === "restore"
            ? "WELCOME BACK"
            : "THE HIVE · BITCOIN WALLET"}
      </p>

      {phase === "preparing" && (
        <>
          <h2>Preparing your wallet</h2>
          <p>Your recovery words will be available later from My Cell.</p>
          <div className="waiting">
            <span className="spinner" aria-hidden="true" />
            <div><b>Securing this browser</b><small>No seed words are shown during startup.</small></div>
          </div>
        </>
      )}

      {phase === "backup" && (
        <>
          <h2>Save your recovery words</h2>
          <p>
            Write these 12 words down in order. They are the key to reopening your Bitcoin wallet.
          </p>
          <div className="hive-recovery">
            <ol>
              {recovery.split(" ").map((word, index) => (
                <li key={index}>
                  <small>{index + 1}</small>
                  {word}
                </li>
              ))}
            </ol>
          </div>
          <textarea
            className="hive-recovery-copy"
            readOnly
            aria-label="Your 12 recovery words"
            value={recovery}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="hive-secondary"
            disabled={busy}
            onClick={() => {
              copiedRecovery.current = seed.current;
              void copy(seed.current, "All 12 recovery words copied.");
            }}
          >
            Copy all 12 words
          </button>
          <p className="hive-key-warning">
            Keep the written copy private. Anyone with these words can open this wallet.
          </p>
          <p className="lightning-muted">
            This recovery controls real funds. Keep it offline and never share it with anyone.
          </p>
          <label className="hive-save-check">
            <input
              type="checkbox"
              checked={backupSaved}
              onChange={(event) => setBackupSaved(event.target.checked)}
            />
            <span>I saved the 12 words somewhere safe.</span>
          </label>
          <button
            disabled={busy || !backupSaved}
            onClick={finishBackup}
          >
            I saved my backup →
          </button>
        </>
      )}

      {phase === "restore" && (
        <>
          <h2>Open your wallet</h2>
          <p>Paste your 12 recovery words below. Older 24-word Hive wallets also work.</p>
          {field(
            "Recovery words",
            <textarea
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onPaste={() => setStatus("Recovery words pasted. Tap Open my wallet.")}
              placeholder="Paste all recovery words here"
            />,
          )}
          <button className="hive-secondary" disabled={busy} onClick={pasteRecovery}>
            Paste words
          </button>
          <button
            disabled={busy || !confirmation.trim()}
            onClick={() => connectAndOpen(confirmation)}
          >
            Open my wallet →
          </button>
        </>
      )}

      {phase === "fund" && (
        <>
          <h2>Fund your Hive wallet</h2>
          <p>
            Your wallet already exists and your 12-word backup controls it. Pay this real
            Lightning invoice to add about $5 in Bitcoin.
          </p>
          {fundingInvoice ? (
            <div className="lightning-invoice hive-wallet-address">
              <div className="lightning-qr">
                <QRCodeSVG value={fundingInvoice.toUpperCase()} size={228} level="M" marginSize={4} />
              </div>
              <b>{fundingSats.toLocaleString()} sats · about $5.00</b>
              <p>Quote: ${fundingUsdRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} per BTC</p>
              {fundingFeeSats > 0 && <small>Breez receive fee: {fundingFeeSats.toLocaleString()} sats</small>}
              <textarea readOnly aria-label="Join The Hive Lightning invoice" value={fundingInvoice} />
              <button onClick={() => copy(fundingInvoice, "Funding invoice copied.")}>Copy invoice</button>
            </div>
          ) : (
            <button disabled={busy} onClick={() => run(() => createFundingInvoice(sdk.current!))}>
              Create a new $5 invoice
            </button>
          )}
          {fundingPaid ? (
            <button
              onClick={() => {
                setPhase("active");
                setStatus("Wallet funded. Your Hive identity keys are ready.");
                onFundingComplete();
              }}
            >
              Payment received — show my keys →
            </button>
          ) : (
            <button
              className="hive-secondary"
              disabled={busy || !fundingInvoice}
              onClick={() =>
                run(async () => {
                  const confirmed = await refreshWallet(sdk.current!);
                  if (!confirmed) setStatus("No confirmed payment yet. Wait a moment, then check again.");
                })
              }
            >
              Check payment
            </button>
          )}
          <p className="hive-key-warning">
            Send only with a Lightning wallet. Do not send on-chain Bitcoin to this QR.
          </p>
        </>
      )}

      {phase === "active" && info && (
        <>
          <h2>Your Hive Bitcoin wallet</h2>
          <div className="lightning-summary">
            <span>Bitcoin mainnet · real funds</span>
            <strong>{info.balanceSats.toLocaleString()} sats</strong>
            <small>Reported by Breez Spark</small>
          </div>
          <p className="hive-key-warning">
            Real Bitcoin: start with a tiny amount. Anyone with your 12 recovery words can
            spend every sat in this wallet.
          </p>

          <details>
            <summary>Public wallet identity</summary>
            <code>{info.identityPubkey}</code>
            <button onClick={() => copy(info.identityPubkey)}>Copy public identity</button>
            <p className="lightning-muted">
              This identity is public, but it is not a Lightning invoice or Bitcoin address.
            </p>
          </details>

          <div className="lightning-buttons">
            <button onClick={onOpenApp}>Open The Hive app</button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await refreshWallet(sdk.current!);
                  setStatus("Bitcoin balance, deposits, and activity refreshed.");
                })
              }
            >
              Refresh wallet
            </button>
          </div>

          {HIVE_LIGHTNING_ENABLED && (
            <>
              <h3>Receive with Lightning</h3>
              <p>Create a real Lightning invoice. Share it only with the person paying you.</p>
              {field(
                "Amount in sats",
                <input
                  inputMode="numeric"
                  value={lightningAmount}
                  onChange={(event) => setLightningAmount(event.target.value)}
                  placeholder="100"
                />,
              )}
              {field(
                "Note (optional)",
                <input
                  value={lightningNote}
                  maxLength={120}
                  onChange={(event) => setLightningNote(event.target.value)}
                  placeholder="What is this payment for?"
                />,
              )}
              <button
                disabled={busy}
                onClick={() => {
                  const amount = Number(lightningAmount);
                  if (!/^\d+$/.test(lightningAmount) || !Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) {
                    setStatus("Enter a whole number from 1 to 100,000,000 sats.");
                    return;
                  }
                  void run(async () => {
                    const result = await sdk.current!.receivePayment({
                      paymentMethod: {
                        type: "bolt11Invoice",
                        amountSats: amount,
                        description: lightningNote.trim(),
                        expirySecs: 3600,
                      },
                    });
                    setLightningInvoice(result.paymentRequest);
                    setStatus("Real Lightning invoice created. It expires in one hour.");
                  });
                }}
              >
                Create Lightning invoice
              </button>
              {lightningInvoice && (
                <div className="lightning-invoice hive-wallet-address">
                  <div className="lightning-qr">
                    <QRCodeSVG value={lightningInvoice.toUpperCase()} size={228} level="M" marginSize={4} />
                  </div>
                  <textarea readOnly aria-label="Lightning invoice" value={lightningInvoice} />
                  <button onClick={() => copy(lightningInvoice, "Lightning invoice copied.")}>Copy invoice</button>
                </div>
              )}
            </>
          )}

          <h3>Receive on Bitcoin</h3>
          <p>
            Generate a new on-chain Bitcoin address. Network mining and deposit-claim fees
            may apply, and deposits require confirmations.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await sdk.current!.receivePayment({
                  paymentMethod: { type: "bitcoinAddress", newAddress: undefined },
                });
                setBitcoinAddress(result.paymentRequest);
                setStatus("Bitcoin deposit address ready. Verify it before sending.");
              })
            }
          >
            Show Bitcoin address
          </button>
          {bitcoinAddress && (
            <div className="lightning-invoice hive-wallet-address">
              <div className="lightning-qr">
                <QRCodeSVG value={bitcoinAddress} size={228} marginSize={4} />
              </div>
              <textarea readOnly aria-label="Bitcoin funding address" value={bitcoinAddress} />
              <div className="lightning-buttons">
                <button onClick={() => copy(bitcoinAddress)}>Copy address</button>
              </div>
            </div>
          )}

          <h3>Receive from a Spark wallet</h3>
          <p>Use this address for direct wallet-to-wallet Spark transfers.</p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await sdk.current!.receivePayment({
                  paymentMethod: { type: "sparkAddress" },
                });
                setSparkAddress(result.paymentRequest);
                setStatus("Spark receive address ready.");
              })
            }
          >
            Show Spark receive address
          </button>
          {sparkAddress && (
            <div className="lightning-invoice hive-wallet-address">
              <div className="lightning-qr">
                <QRCodeSVG value={sparkAddress} size={228} marginSize={4} />
              </div>
              <textarea readOnly aria-label="Spark receive address" value={sparkAddress} />
              <button onClick={() => copy(sparkAddress)}>Copy Spark address</button>
            </div>
          )}

          {unclaimedCount > 0 && (
            <p className="lightning-status" role="status">
              {unclaimedCount} deposit{unclaimedCount === 1 ? "" : "s"} awaiting claim ·{" "}
              {unclaimedSats.toLocaleString()} sats
            </p>
          )}

          <h3>Wallet activity</h3>
          {payments.length ? (
            payments.map((payment) => (
              <div className="lightning-transaction" key={payment.id}>
                <span>
                  {payment.paymentType === "receive" ? "Received" : "Sent"} · {payment.status}
                  <small>{payment.method}</small>
                </span>
                <b>{payment.amount.toString()} sats</b>
              </div>
            ))
          ) : (
            <p>No wallet activity yet.</p>
          )}
        </>
      )}

      {hasSession && phase !== "backup" && (
        <button className="hive-secondary" disabled={busy} onClick={lockWallet}>
          Lock wallet
        </button>
      )}
      {status && (
        <p className="lightning-status" role="status" aria-live="polite">
          {busy ? "Working… " : ""}
          {status}
        </p>
      )}
    </div>
  );
}
