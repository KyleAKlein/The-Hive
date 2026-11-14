"use client";

import { useState, type FormEvent } from "react";
import { satsToMsats } from "@/lib/lightning";

export default function LockedTextForm({ createInvoice }: {
  createInvoice: (sats: number) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title")).trim();
    const body = String(fields.get("body")).trim();
    setError("");
    setBusy(true);
    try {
      if (!title || !body) throw new Error("Enter a title and the text to lock.");
      const sats = satsToMsats(String(fields.get("sats"))) / 1000;
      const invoice = await createInvoice(sats);
      const response = await fetch("/api/locked-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, invoice, sats }),
      });
      const result = await response.json() as { error?: string; id?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Could not create the link.");
      setLink(new URL("/locked-text/" + result.id, location.origin).href);
    } catch (cause) {
      setError(cause instanceof Error && !(cause instanceof SyntaxError) ? cause.message : "Could not create the link.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button onClick={() => setOpen(true)}>Create locked text</button>;
  if (link) return <div className="lightning-invoice">
    <label>Share this link<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
    <button onClick={() => { setLink(""); setOpen(false); }}>Done</button>
  </div>;

  return <form className="lightning-invoice" onSubmit={publish}>
    <h3>Create locked text</h3>
    <p>Share this link with one buyer. The Lightning invoice expires after 24 hours.</p>
    <fieldset disabled={busy}>
      <label>Public title<input name="title" required maxLength={120} /></label>
      <label>Locked text<textarea name="body" required maxLength={16000} /></label>
      <label>Price in sats<input name="sats" inputMode="numeric" pattern="[1-9][0-9]*" required /></label>
      <button type="submit">{busy ? "Creating link…" : "Create payment link"}</button>
      <button type="button" onClick={() => { setError(""); setOpen(false); }}>Cancel</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
