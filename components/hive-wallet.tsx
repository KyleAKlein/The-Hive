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
  HIVE_WALLET_NETWORK,
  normalizeRecovery,
} from "@/lib/hive-wallet";

type Phase = "restore" | "backup" | "active";

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
  onBack,
  onOpenApp,
}: {
  intent: "join" | "restore" | null;
  onBack: () => void;
  onOpenApp: () => void;
}) {
  const seed = useRef("");
  const sdk = useRef<BreezSdk | null>(null);
  const listenerId = useRef<string | null>(null);
  const operationLocked = useRef(false);
  const copiedRecovery = useRef("");
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

  useEffect(() => {
    if (intent === "join" && !seed.current) {
      seed.current = createRecovery();
      setRecovery(seed.current);
      setPhase("backup");
      setStatus("Recovery words were generated on this device. No wallet has been funded.");
    } else if (intent === "restore" && !seed.current) {
      setPhase("restore");
    }
  }, [intent]);

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
        "The regtest wallet operation could not be completed. Your recovery words have not changed. Check the connection and try again.",
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
    setUnclaimedCount(unclaimed.deposits.length);
    setUnclaimedSats(
      unclaimed.deposits.reduce((total, deposit) => total + deposit.amountSats, 0),
    );
  }

  async function disconnectWallet() {
    const client = sdk.current;
    const activeListener = listenerId.current;
    listenerId.current = null;
    sdk.current = null;
    if (!client) return;
    if (activeListener) await client.removeEventListener(activeListener).catch(() => false);
    await client.disconnect().catch(() => undefined);
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
    setPhase("restore");
  }

  async function lockWallet() {
    await run(async () => {
      await disconnectWallet();
      resetWalletState();
      setStatus("Wallet locked. Use your saved Hive recovery words to return.");
    });
  }

  async function leaveWallet() {
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

  async function connectAndOpen(words: string) {
    let mnemonic: string;
    try {
      mnemonic = checkRecovery(words);
    } catch {
      setStatus("Those recovery words are not valid. Check the spelling and order.");
      return;
    }
    await run(async () => {
      seed.current = mnemonic;
      setStatus("Opening your test wallet…");
      const connected = await connectHiveWallet(mnemonic);
      sdk.current = connected;
      try {
        listenerId.current = await connected.addEventListener({
          onEvent(event) {
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
      setPhase("active");
      setStatus("Test wallet connected.");
      onOpenApp();
    });
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
        ← Welcome
      </button>
      <p className="step">
        {phase === "backup"
          ? "FINAL BACKUP"
          : phase === "restore"
            ? "WELCOME BACK"
            : "THE HIVE · TEST WALLET"}
      </p>

      {phase === "backup" && (
        <>
          <h2>Save your recovery words</h2>
          <p>
            Before entering the app, write these 12 words down in order. They are the key to
            reopening your test wallet.
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
            This first release is locked to regtest. Regtest coins have no real-world value.
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
            onClick={() => connectAndOpen(seed.current)}
          >
            Open The Hive app →
          </button>
        </>
      )}

      {phase === "restore" && (
        <>
          <h2>Open your wallet</h2>
          <p>Paste your 12 recovery words below. Older 24-word Hive test wallets also work.</p>
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

      {phase === "active" && info && (
        <>
          <h2>Your Hive test wallet</h2>
          <div className="lightning-summary">
            <span>{HIVE_WALLET_NETWORK} · test funds only</span>
            <strong>{info.balanceSats.toLocaleString()} sats</strong>
            <small>Reported by Breez Spark regtest</small>
          </div>
          <p className="hive-key-warning">
            Regtest lab: these coins have no monetary value. Mainnet, real payments, signup
            fees, and Cell registration are disabled.
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
                  setStatus("Regtest balance, deposits, and activity refreshed.");
                })
              }
            >
              Refresh wallet
            </button>
          </div>

          <h3>Fund with test sats</h3>
          <p>
            Generate a regtest Bitcoin address, then paste it into the Lightspark faucet.
            Deposits normally need confirmations before the wallet can claim them.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await sdk.current!.receivePayment({
                  paymentMethod: { type: "bitcoinAddress", newAddress: undefined },
                });
                setBitcoinAddress(result.paymentRequest);
                setStatus("Regtest funding address ready. No funds have been requested yet.");
              })
            }
          >
            Show regtest funding address
          </button>
          {bitcoinAddress && (
            <div className="lightning-invoice hive-regtest-address">
              <div className="lightning-qr">
                <QRCodeSVG value={bitcoinAddress} size={228} marginSize={4} />
              </div>
              <textarea readOnly aria-label="Regtest Bitcoin funding address" value={bitcoinAddress} />
              <div className="lightning-buttons">
                <button onClick={() => copy(bitcoinAddress)}>Copy address</button>
                <a
                  className="hive-faucet-link"
                  href="https://app.lightspark.com/regtest-faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open regtest faucet ↗
                </a>
              </div>
            </div>
          )}

          <h3>Receive from a Spark test wallet</h3>
          <p>Use this address for wallet-to-wallet Spark transfers on the regtest network.</p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await sdk.current!.receivePayment({
                  paymentMethod: { type: "sparkAddress" },
                });
                setSparkAddress(result.paymentRequest);
                setStatus("Spark regtest receive address ready.");
              })
            }
          >
            Show Spark receive address
          </button>
          {sparkAddress && (
            <div className="lightning-invoice hive-regtest-address">
              <div className="lightning-qr">
                <QRCodeSVG value={sparkAddress} size={228} marginSize={4} />
              </div>
              <textarea readOnly aria-label="Spark regtest receive address" value={sparkAddress} />
              <button onClick={() => copy(sparkAddress)}>Copy Spark address</button>
            </div>
          )}

          {unclaimedCount > 0 && (
            <p className="lightning-status" role="status">
              {unclaimedCount} deposit{unclaimedCount === 1 ? "" : "s"} awaiting claim ·{" "}
              {unclaimedSats.toLocaleString()} sats
            </p>
          )}

          {!HIVE_LIGHTNING_ENABLED && (
            <div className="lightning-summary">
              <b>Lightning stays off in regtest</b>
              <p>
                Breez regtest does not have a developed Lightning Network. BOLT11 send and
                receive will be enabled only after a separate tiny-value mainnet test.
              </p>
            </div>
          )}

          <h3>Test-wallet activity</h3>
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
            <p>No regtest wallet activity yet.</p>
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
