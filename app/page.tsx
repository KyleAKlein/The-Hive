"use client";

import { useState } from "react";
import { ArrowLeft, Check, Clock3, Copy, KeyRound, QrCode, Send, ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Screen = "welcome" | "join" | "creating" | "keys" | "enter" | "home";

function FeesExplained() {
  return <details className="fee-details">
    <summary>Fees explained <span aria-hidden="true">⌄</span></summary>
    <div className="fee-content">
      <h3>The sting, explained.</h3>
      <p><strong>$1 to join, once.</strong> Paid in bitcoin. This signup fee goes to The Hive and is not part of your spendable balance.</p>
      <p><strong>Sending on Bitcoin.</strong> Blockchain fees vary with network demand. Your sending wallet shows its fee before you confirm.</p>
      <p><strong>Using Lightning.</strong> Payments generally have much smaller network fees. The amount depends on the payment and its route.</p>
      <p className="fee-footnote">Network fees are separate from The Hive’s signup fee.</p>
    </div>
  </details>;
}

function HiveMark({ compact = false }: { compact?: boolean }) {
  return <div className={`hive-mark ${compact ? "compact" : ""}`} aria-label="The Hive logo"><span className="hex h1"/><span className="hex h2"/><span className="hex h3"/></div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [key, setKey] = useState("");

  return <main className="startup-stage">
    <div className="ambient-grid" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <section className={`phone-surface ${screen === "welcome" ? "original-entrance" : ""}`} aria-live="polite">
      {screen === "welcome" && <div className="original-artwork">
        <img src="/hive-original-welcome.png" alt="The Hive. People, payments, possibilities. Small Payments. A Bigger World." width="252" height="506" draggable={false}/>
        <button className="artwork-action artwork-join" onClick={() => setScreen("join")} aria-label="Join The Hive — Send Bitcoin. Get Your Cell."/>
        <button className="artwork-action artwork-enter" onClick={() => setScreen("enter")} aria-label="Enter The Hive — I already have a key."/>
      </div>}

      {screen === "join" && <div className="flow-screen join-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 1 OF 3</p><h2>Join The Hive</h2><p className="flow-copy">A one-time signup. Your own Cell.</p>
        <div className="payment-fees" aria-label="Signup fee breakdown"><div><span>One-time signup</span><strong>$1.00</strong></div><div><span>Sending fee</span><span>Shown in your wallet</span></div><p>The $1 signup fee is paid in bitcoin and does not become wallet balance.</p></div>
        <FeesExplained/>
        <p className="payment-demo">Payment preview · No bitcoin will move</p>
        <div className="qr-frame"><div className="fake-qr" aria-label="Placeholder QR illustration, not a payment code"><QrCode/></div></div>
        <p className="address">Demo only · No payment address</p>
        <div className="waiting"><span className="spinner"/><div><b>Waiting for your transaction…</b><small>This is a visual demo. No bitcoin will move.</small></div></div>
        <Button className="demo-forward" onClick={() => setScreen("creating")}>Transaction Received <span>Continue →</span></Button>
        <div className="progress"><span className="active">1<i>Send</i></span><span>2<i>Create</i></span><span>3<i>Receive keys</i></span></div>
      </div>}

      {screen === "creating" && <div className="flow-screen creating-screen">
        <button className="back" onClick={() => setScreen("join")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 2 OF 3</p><h2>Creating Your Hive</h2><p className="flow-copy">Your Bitcoin has been received. We’re setting up your Lightning wallet, Cell, and keys.</p>
        <div className="creation-emblem"><HiveMark compact/></div>
        <div className="check-list"><p><span><Check/></span>Confirming transaction</p><p><span><Check/></span>Creating your wallet</p><p><span><Check/></span>Loading to Lightning</p><p><span className="working"><Check/></span>Generating your keys</p></div>
        <Button className="demo-forward" onClick={() => setScreen("keys")}>Finish Creating <span>Continue →</span></Button>
        <div className="progress"><span>1<i>Send</i></span><span className="active">2<i>Create</i></span><span>3<i>Receive keys</i></span></div>
      </div>}

      {screen === "keys" && <div className="flow-screen keys-screen">
        <button className="back" onClick={() => setScreen("creating")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 3 OF 3</p><h2>Your Hive is Ready</h2><p className="flow-copy">Save your keys. The private key gives access to your wallet; the public key lets others send to you.</p>
        <div className="key-pair"><div className="key-card private"><div className="mini-qr"><QrCode/></div><b>PRIVATE KEY</b><small>Keep this secret. Save it somewhere safe.</small></div><div className="key-card public"><div className="mini-qr"><QrCode/></div><b>PUBLIC KEY</b><small>Share this to receive sats.</small></div></div>
        <div className="cell-card"><span>Your Cell</span><strong>D-313 <Copy size={17}/></strong><small>This is your Hive identity.</small></div>
        <Button className="unlock" onClick={() => setScreen("home")}>I’ve Saved My Keys</Button>
        <p className="session-note">Demo keys only—nothing sensitive is being generated or stored.</p>
      </div>}

      {screen === "enter" && <div className="flow-screen enter-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="identity small"><HiveMark/><h1>THE HIVE</h1><p>PEOPLE <b>•</b> PAYMENTS <b>•</b> POSSIBILITIES</p></div>
        <h2>Enter The Hive</h2><p className="flow-copy">Paste or scan your private key to access your wallet.</p>
        <label className="key-field"><KeyRound size={19}/><Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your private key here…" aria-label="Private key"/><button aria-label="Scan private key"><QrCode size={20}/></button></label>
        <Button className="unlock" disabled={!key.trim()} onClick={() => setScreen("home")}>Unlock</Button>
        <p className="session-note"><Zap size={15}/> Your key is used only for this session and is never saved.</p>
      </div>}

      {screen === "home" && <div className="flow-screen home-screen">
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <div className="cell-badge"><span>D-313</span><Copy size={16}/></div>
        <p className="home-label">YOUR CELL</p><h2>21,340 sats</h2><p className="fiat">≈ $14.28</p>
        <div className="home-actions"><button><Send/><span>Send</span></button><button><QrCode/><span>Receive</span></button><button><Users/><span>The Hive</span></button><button><Clock3/><span>Activity</span></button></div>
        <button className="restart" onClick={() => { setKey(""); setScreen("welcome"); }}>Return to startup</button>
        <p className="custody-note"><ShieldCheck size={15}/> Your keys. Your control. Always.</p>
      </div>}
    </section>
  </main>;
}
