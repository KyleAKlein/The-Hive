"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  BreezSdk,
  GetInfoResponse,
  Payment,
  SdkEvent,
} from "@breeztech/breez-sdk-spark/ssr";
import { QRCodeSVG } from "qrcode.react";
import WalletUnlock from "@/components/wallet-unlock";
import { ArrowLeft } from "lucide-react";
import {
  checkRecovery,
  createWalletPrivateKey,
  restoreWalletPrivateKey,
  connectHiveWallet,
  createRecovery,
  HIVE_LIGHTNING_ENABLED,
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
  visible,
  intent,
  initialRecovery,
  backupRequest,
  onConnectionChange,
  onRecoveryReady,
  onBack,
  onOpenApp,
  onFundingComplete,
}: {
  visible: boolean;
  intent: "join" | "restore" | null;
  initialRecovery: string;
  backupRequest: number;
  onConnectionChange: (connected: boolean) => void;
  onRecoveryReady: (recovery: string) => void;
  onBack: () => void;
  onOpenApp: () => void;
  onFundingComplete: () => void;
}) {
  const seed = useRef("");
  const sdk = useRef<BreezSdk | null>(null);
  const listenerId = useRef<string | null>(null);
  const operationLocked = useRef(false);
  const fundingInvoiceRef = useRef("");
  const [phase, setPhase] = useState<Phase>("restore");
  const [recovery, setRecovery] = useState("");
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
  const [fundingPaid, setFundingPaid] = useState(false);

  useEffect(() => {
    if (intent === "join" && !seed.current) {
      setPhase("preparing");
      setStatus("Securing your new wallet on this browser before creating the funding QR…");
      void startJoin(initialRecovery);
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
    setStatus("Preparing your receiving QR…");
    const result = await client.receivePayment({
      paymentMethod: {
        type: "bolt11Invoice",
        description: "Join The Hive · wallet funding",
        expirySecs: 86400,
      },
    });
    fundingInvoiceRef.current = result.paymentRequest;
    setFundingInvoice(result.paymentRequest);
    setStatus("");
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

  async function connectWallet(mnemonic: string, destination: "active" | "fund") {
    seed.current = mnemonic;
    onRecoveryReady(mnemonic);
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
    setRecovery("");
    setStatus("Bitcoin wallet connected.");
    onConnectionChange(true);
    if (destination === "fund") {
      await createFundingInvoice(connected);
    } else {
      setPhase("active");
      // A successful login should enter The Hive, not stop on the wallet tools page.
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
      mnemonic = restoreWalletPrivateKey(words);
    } catch {
      setStatus("That wallet private key or recovery phrase is not valid. Older Hive identity keys cannot restore a Bitcoin wallet.");
      return;
    }
    await run(async () => {
      if (persistUntilBackup) await saveRecoveryToDevice(mnemonic);
      await connectWallet(mnemonic, destination);
    });
  }

  async function startJoin(candidate: string) {
    const saved = await loadRecoveryFromDevice();
    const mnemonic = saved ?? (candidate ? checkRecovery(candidate) : createRecovery());
    seed.current = mnemonic;
    onRecoveryReady(mnemonic);
    await connectAndOpen(mnemonic, "fund", !saved);
  }

  async function openSavedWallet() {
    await run(async () => {
      const saved = await loadRecoveryFromDevice();
      if (!saved) {
        setPhase("restore");
        setStatus("");
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
  const joining = phase === "fund" || (phase === "preparing" && intent === "join");

  return (
    <div className={`hive-wallet lightning-wallet${joining ? " join-screen live-join" : phase === "restore" ? " wallet-restore-screen" : ""}`}>
      <button disabled={busy} onClick={leaveWallet} className="hive-wallet-back">
        {phase === "restore" ? <ArrowLeft size={20} aria-label="Back to welcome" /> : phase === "backup" ? "← My Cell" : "← Welcome"}
      </button>
      {(joining || phase === "restore") && <div className="mini-brand"><svg className="hive-mark compact" viewBox="0 0 104 104" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round"><path d="M52 5 75 18v27L52 58 29 45V18z"/><path d="M29 45 52 58v27L29 98 6 85V58z"/><path d="M75 45 98 58v27L75 98 52 85V58z"/></g></svg><span>THE HIVE</span></div>}
      <p className="step" hidden={phase === "restore"}>
        {phase === "backup"
          ? "WALLET BACKUP · MY CELL"
          : phase === "preparing"
            ? (joining ? "STEP 1 OF 2" : "CREATING YOUR WALLET")
          : phase === "fund"
            ? "STEP 1 OF 2"
          : phase === "restore"
            ? "WELCOME BACK"
            : "THE HIVE · BITCOIN WALLET"}
      </p>

      {phase === "preparing" && (
        <>
          <h2>{joining ? "Create your wallet" : "Preparing your wallet"}</h2>
          <p>Your recovery words will be available later from My Cell.</p>
          <div className="waiting">
            <span className="spinner" aria-hidden="true" />
            <div><b>Securing this browser</b><small>No seed words are shown during startup.</small></div>
          </div>
        </>
      )}

      {phase === "backup" && (
        <>
          <h2>Save your wallet private key</h2>
          <p>This private key restores your Bitcoin wallet on another device. Keep it secret and offline.</p>
          <div className="lightning-qr hive-private-qr"><QRCodeSVG value={createWalletPrivateKey(recovery)} size={228} marginSize={4} /></div>
          <textarea className="hive-recovery-copy" readOnly aria-label="Wallet private key" value={createWalletPrivateKey(recovery)} onFocus={event => event.currentTarget.select()} />
          <button onClick={() => copy(createWalletPrivateKey(recovery), "Wallet private key copied.")}>Copy private key</button>
          <h3>Alternative: recovery words</h3>
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
            <span>I saved my private key or recovery words somewhere safe.</span>
          </label>
          <button
            disabled={busy || !backupSaved}
            onClick={finishBackup}
          >
            I saved my backup →
          </button>
        </>
      )}

      {phase === "restore" && visible && <WalletUnlock busy={busy} onUnlock={connectAndOpen} />}

      {phase === "fund" && (
        <>
          <h2>Create your wallet</h2>
          <p className="flow-copy">Start your Hive wallet by sending Bitcoin to this QR code.</p>
          <p className="join-fee-copy">Scan with a Lightning wallet and choose how much to send.</p>
          <details className="funding-backup"><summary>Save your private key before sending</summary><p>Use this key to reopen your wallet if this page refreshes. Keep it private.</p><textarea readOnly aria-label="Wallet private key backup" value={seed.current ? createWalletPrivateKey(seed.current) : ""} onFocus={event => event.currentTarget.select()} /><button disabled={!seed.current} onClick={() => copy(createWalletPrivateKey(seed.current), "Wallet private key copied. Save it somewhere private before sending.")}>Copy private key</button></details>
          {fundingInvoice ? (
            <div className="lightning-invoice hive-wallet-address">
              <div className="funding-hex">
                <svg className="funding-hex-border" viewBox="0 0 320 360" fill="none" aria-hidden="true"><path d="M150 9Q160 3 170 9L303 85Q313 91 313 103V257Q313 269 303 275L170 351Q160 357 150 351L17 275Q7 269 7 257V103Q7 91 17 85Z" fill="#090c08" stroke="#d7ad58" strokeWidth="3"/></svg>
                <div className="funding-hex-code"><QRCodeSVG aria-label="Lightning wallet funding QR code" value={fundingInvoice.toUpperCase()} size={228} level="M" marginSize={4} /></div>
              </div>
              <button className="join-copy-invoice" onClick={() => copy(fundingInvoice, "Payment code copied.")}>Copy payment code</button>
              <p className="join-fee-note">Valid for 24 hours · Your sending wallet shows applicable fees.</p>
            </div>
          ) : (
            busy ? <p role="status">Preparing your QR code…</p> :
            <button disabled={!sdk.current} onClick={() => run(() => createFundingInvoice(sdk.current!))}>
              Retry loading QR code
            </button>
          )}
          <div className="waiting">
            {!fundingPaid && <span className="spinner" aria-hidden="true" />}
            <div><b>{fundingPaid ? "Transaction received" : "Waiting for your transaction…"}</b><small>{fundingPaid ? "Your wallet is funded. Continue to save your keys." : "Your payment will be confirmed here."}</small></div>
          </div>
          {fundingPaid ? (
            <button
              onClick={() => {
                setPhase("active");
                setStatus("Wallet funded. Your wallet keys are ready.");
                onFundingComplete();
              }}
            >
              Transaction received · Continue →
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
          {!fundingPaid && (
            <button
              className="hive-secondary"
              disabled={busy || !seed.current || !sdk.current}
              onClick={() => {
                setPhase("active");
                setStatus("Wallet created without funding. Save your private key before leaving.");
                onFundingComplete();
              }}
            >
              Create wallet without sending Bitcoin →
            </button>
          )}
          <p className="join-fee-note">You can fund your wallet later. Save your private key securely before leaving this screen.</p>
          <div className="progress"><span className="active">1<i>Fund</i></span><span>2<i>Receive keys</i></span></div>
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

      {hasSession && phase !== "backup" && !joining && (
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
