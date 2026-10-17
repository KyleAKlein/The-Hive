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
  backupMatches,
  checkRecovery,
  connectHiveWallet,
  createRecovery,
  HIVE_LIGHTNING_ENABLED,
  HIVE_WALLET_NETWORK,
} from "@/lib/hive-wallet";

type Phase = "restore" | "backup" | "verify" | "configure" | "active";

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
}: {
  intent: "join" | "restore" | null;
  onBack: () => void;
}) {
  const seed = useRef("");
  const sdk = useRef<BreezSdk | null>(null);
  const listenerId = useRef<string | null>(null);
  const operationLocked = useRef(false);
  const [phase, setPhase] = useState<Phase>("restore");
  const [recovery, setRecovery] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [checks, setChecks] = useState([false, false, false]);
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
    setChecks([false, false, false]);
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

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied.");
    } catch {
      setStatus("Clipboard unavailable. Select the text and copy it manually.");
    }
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
          ? "REGTEST · 1 OF 3"
          : phase === "verify"
            ? "REGTEST · 2 OF 3"
            : phase === "configure"
              ? "REGTEST · 3 OF 3"
              : "THE HIVE · REGTEST"}
      </p>

      {phase === "backup" && (
        <>
          <h2>Save your recovery words</h2>
          <p>
            This creates a self-custodial test wallet on your device. Write these 24 words
            down in order and keep them private.
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
          <p className="hive-key-warning">
            Do not screenshot or paste these words into email, chat, cloud notes, or a
            password field. Anyone with them can control this wallet.
          </p>
          <p className="lightning-muted">
            This first release is locked to regtest. Regtest coins have no real-world value.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              setPhase("verify");
              setRecovery("");
            }}
          >
            I wrote them down →
          </button>
        </>
      )}

      {phase === "verify" && (
        <>
          <h2>Verify your saved words</h2>
          <p>Type the 24 words you saved, in order.</p>
          {field(
            "Your 24 recovery words",
            <textarea
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />,
          )}
          <div className="hive-checks">
            {[
              "I wrote down a private offline copy.",
              "I understand anyone with these words can control the wallet.",
              "I understand Hive cannot replace lost recovery words.",
            ].map((label, index) => (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={checks[index]}
                  onChange={(event) =>
                    setChecks((old) =>
                      old.map((value, item) => (item === index ? event.target.checked : value)),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button
            disabled={busy || checks.some((value) => !value) || !confirmation.trim()}
            onClick={() => {
              try {
                if (!backupMatches(seed.current, confirmation)) {
                  setStatus("Those words do not match. Check your saved copy and try again.");
                  return;
                }
                setConfirmation("");
                setRecovery("");
                setPhase("configure");
                setStatus("Backup verified. The regtest wallet is ready to start.");
              } catch {
                setStatus("Check all 24 words and their order.");
              }
            }}
          >
            Verify and continue →
          </button>
          <button
            className="hive-secondary"
            onClick={() => {
              setRecovery(seed.current);
              setPhase("backup");
            }}
          >
            Show the words again
          </button>
        </>
      )}

      {phase === "restore" && (
        <>
          <h2>Enter the regtest wallet</h2>
          <p>Use recovery words created by this Hive regtest wallet.</p>
          {field(
            "Recovery words",
            <textarea
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />,
          )}
          <button
            disabled={busy || !confirmation.trim()}
            onClick={() => {
              try {
                seed.current = checkRecovery(confirmation);
                setConfirmation("");
                setPhase("configure");
                setStatus("Recovery words accepted locally. Start regtest to restore the wallet.");
              } catch {
                setStatus("Enter valid Hive recovery words in the original order.");
              }
            }}
          >
            Continue
          </button>
        </>
      )}

      {phase === "configure" && (
        <>
          <h2>Start the test wallet</h2>
          <div className="lightning-summary">
            <b>Regtest · test funds only</b>
            <p>
              Breez regtest does not require an API key. It cannot hold or move real bitcoin,
              and no Hive signup fee will be charged.
            </p>
          </div>
          <p>
            The wallet engine will keep its working state in this browser. Your recovery words
            remain the key to restoring it.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                setStatus("Loading the wallet engine and connecting to Breez regtest…");
                const connected = await connectHiveWallet(seed.current);
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
                setPhase("active");
                setStatus("Regtest wallet connected. No real bitcoin is enabled.");
              })
            }
          >
            Start regtest wallet
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

      {hasSession && phase !== "backup" && phase !== "verify" && (
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
