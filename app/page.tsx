"use client";

import { useState } from "react";
import { ArrowLeft, Copy, KeyRound, QrCode, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Screen = "welcome" | "join" | "enter";

function HiveMark({ compact = false }: { compact?: boolean }) {
  return <div className={`hive-mark ${compact ? "compact" : ""}`} aria-label="The Hive logo"><span className="hex h1"/><span className="hex h2"/><span className="hex h3"/></div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [key, setKey] = useState("");

  return <main className="startup-stage">
    <div className="ambient-grid" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <section className="phone-surface" aria-live="polite">
      {screen === "welcome" && <div className="welcome-screen">
        <div className="identity"><HiveMark/><h1>THE HIVE</h1><p>PEOPLE <b>•</b> PAYMENTS <b>•</b> POSSIBILITIES</p></div>
        <div className="promise">Small Payments.<br/>A Bigger World.</div>
        <div className="entry-actions">
          <button className="hex-action join" onClick={() => setScreen("join")}><span><strong>JOIN<br/>THE HIVE</strong><small>Send Bitcoin.<br/>Get Your Cell.</small></span></button>
          <button className="hex-action enter" onClick={() => setScreen("enter")}><span><strong>ENTER<br/>THE HIVE</strong><small>I already<br/>have a key.</small></span></button>
        </div>
        <p className="custody-note"><ShieldCheck size={15}/> The Hive never holds your bitcoin.</p>
      </div>}

      {screen === "join" && <div className="flow-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 1 OF 3</p><h2>Send Bitcoin</h2><p className="flow-copy">Send any amount to create your Lightning wallet and claim your Cell.</p>
        <div className="qr-frame"><div className="fake-qr" aria-label="Demo Lightning QR code"><QrCode/></div></div>
        <button className="address"><span>bc1q4z3...9f7e</span><Copy size={17}/></button>
        <div className="waiting"><span className="spinner"/><div><b>Waiting for your transaction…</b><small>This is a visual demo. No bitcoin will move.</small></div></div>
        <div className="progress"><span className="active">1<i>Send</i></span><span>2<i>Create</i></span><span>3<i>Receive keys</i></span></div>
      </div>}

      {screen === "enter" && <div className="flow-screen enter-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="identity small"><HiveMark/><h1>THE HIVE</h1><p>PEOPLE <b>•</b> PAYMENTS <b>•</b> POSSIBILITIES</p></div>
        <h2>Enter The Hive</h2><p className="flow-copy">Paste or scan your private key to access your wallet.</p>
        <label className="key-field"><KeyRound size={19}/><Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your private key here…" aria-label="Private key"/><button aria-label="Scan private key"><QrCode size={20}/></button></label>
        <Button className="unlock" disabled={!key.trim()} onClick={() => setKey("")}>Unlock</Button>
        <p className="session-note"><Zap size={15}/> Your key is used only for this session and is never saved.</p>
      </div>}
    </section>
    <aside className="design-note"><span>STARTUP / 01</span><h2>One choice.<br/>Two clear paths.</h2><p>New members create a self-custodial Cell. Returning members unlock theirs with the key only they control.</p></aside>
  </main>;
}
