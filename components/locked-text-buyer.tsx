"use client";

import { useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";

type Offer = { title: string; sats: number; invoice: string; expires: number };

export default function LockedTextBuyer({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer>();
  const [text, setText] = useState<string>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = "/api/locked-text/" + encodeURIComponent(id);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      setOffer(await response.json());
    }).catch(() => {
      if (!controller.signal.aborted) setStatus("Could not load this locked text link.");
    });
    return () => controller.abort();
  }, [endpoint]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const preimage = new FormData(event.currentTarget).get("preimage");
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preimage }),
      });
      const result = await response.json() as { error?: string; body?: string };
      if (!response.ok || result.body === undefined) throw new Error(result.error || "Could not unlock the text.");
      setText(result.body);
    } catch (error) {
      setStatus(error instanceof Error && !(error instanceof SyntaxError) ? error.message : "Could not unlock the text.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flow-screen lightning-screen" style={{ maxWidth: 480, margin: "auto", padding: 24 }}>
    <h1>{offer?.title ?? "Locked text"}</h1>
    {offer && (text === undefined ? <>
      <p>{offer.sats.toLocaleString()} sats</p>
      {offer.expires * 1000 > Date.now() ? <div className="lightning-invoice">
        <div className="lightning-qr"><QRCodeSVG value={offer.invoice.toUpperCase()} marginSize={4} size={224} /></div>
        <a href={"lightning:" + offer.invoice}>Open Lightning wallet</a>
        <textarea readOnly aria-label="Lightning invoice" value={offer.invoice} onFocus={event => event.currentTarget.select()} />
        <button onClick={() => void navigator.clipboard.writeText(offer.invoice).then(
          () => setStatus("Invoice copied."),
          () => setStatus("Select the invoice to copy it."),
        )}>Copy invoice</button>
      </div> : <p>This invoice has expired.</p>}
      <form className="lightning-invoice" onSubmit={unlock}>
        <p>After paying, copy the payment preimage from your wallet’s transaction details.</p>
        <label>Payment preimage<input name="preimage" required pattern="[a-fA-F0-9]{64}" autoComplete="off" spellCheck={false} /></label>
        <button disabled={busy}>{busy ? "Checking payment…" : "Unlock text"}</button>
      </form>
    </> : <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</div>)}
    <p role="status">{status || (!offer ? "Loading…" : "")}</p>
  </main>;
}
