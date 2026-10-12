"use client";

import { useState } from "react";
import { allocateDeposit } from "@/lib/bucket-math";
import { ArrowLeft, Check, Clock3, Copy, KeyRound, QrCode, Send, ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Screen = "welcome" | "join" | "creating" | "keys" | "enter" | "home" | "private-key" | "public-key" | "send" | "receive" | "activity" | "buckets";

function FeesExplained() {
  return <details className="fee-details">
    <summary>Fees explained <span aria-hidden="true">⌄</span></summary>
    <div className="fee-content">
      <h3>The sting, explained.</h3>
      <p><strong>$1 to join, once.</strong> Paid in bitcoin. This signup fee goes to The Hive and is not part of your spendable balance.</p>
      <p><strong>Sending on Bitcoin.</strong> Blockchain fees vary with network demand. Your sending wallet shows its fee before you confirm.</p>
      <p><strong>Using Lightning.</strong> Payments generally have much smaller network fees. The amount depends on the payment and its route.</p>
      <p className="fee-footnote">These are demo estimates, not live quotes. The total includes estimated costs, not a payment request: your sending wallet charges its Bitcoin fee separately. Lightning costs depend on the funding method and provider; both network fees may not apply.</p>
    </div>
  </details>;
}

function HiveMark({ compact = false }: { compact?: boolean }) {
  return <svg className={`hive-mark ${compact ? "compact" : ""}`} viewBox="0 0 104 104" fill="none" role="img" aria-label="The Hive logo"><g stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round"><path d="M52 5 75 18v27L52 58 29 45V18z"/><path d="M29 45 52 58v27L29 98 6 85V58z"/><path d="M75 45 98 58v27L75 98 52 85V58z"/></g></svg>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [key, setKey] = useState("");

  const [balance, setBalance] = useState(21340);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [transactions, setTransactions] = useState<{id: number; kind: "sent" | "received" | "allocated" | "released"; cell: string; amount: number; time: string}[]>([]);
  const [buckets, setBuckets] = useState<{id:number; name:string; kind:"habit" | "savings"; balance:number; percent:number; reward:number; completions:number}[]>([]);
  const [bucketName, setBucketName] = useState("");
  const [bucketKind, setBucketKind] = useState<"habit" | "savings">("savings");
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [bucketAmount, setBucketAmount] = useState("");
  const [bucketNotice, setBucketNotice] = useState("");
  const [ruleDraft, setRuleDraft] = useState<Record<number,string>>({});
  const [editingRules, setEditingRules] = useState(false);
  const reserved = buckets.reduce((total,bucket) => total+bucket.balance,0);
  const totalBalance = balance+reserved;
  const selected = buckets.find(bucket => bucket.id === selectedBucket);
  const transferAmount = Number(bucketAmount);
  const validTransfer = /^\d+$/.test(bucketAmount) && Number.isSafeInteger(transferAmount) && transferAmount > 0;
  const draftTotal = buckets.reduce((total,bucket) => total+Number(ruleDraft[bucket.id] ?? bucket.percent),0);
  const rulesValid = buckets.every(bucket => /^\d+$/.test(ruleDraft[bucket.id] ?? String(bucket.percent)) && Number(ruleDraft[bucket.id] ?? bucket.percent) <= 100) && draftTotal <= 100;
  const addHistory = (kind:"allocated" | "released", cell:string, value:number) => setTransactions(old => [{id:Date.now()+Math.random(),kind,cell,amount:value,time:new Date().toLocaleString()},...old]);
  const moveBucket = (direction:"in" | "out", value:number, habit=false) => {
    if (!selected || !Number.isSafeInteger(value) || value <= 0 || value > (direction === "in" ? balance : selected.balance)) return;
    setBalance(old => old+(direction === "in" ? -value : value));
    setBuckets(old => old.map(bucket => bucket.id === selected.id ? {...bucket,balance:bucket.balance+(direction === "in" ? value : -value),completions:bucket.completions+(habit ? 1 : 0)} : bucket));
    addHistory(direction === "in" ? "allocated" : "released", `${habit ? "Habit reward · " : ""}${selected.name}`, value);
    setBucketAmount("");setBucketNotice(habit ? `Habit logged. ${value.toLocaleString()} sats set aside.` : `${value.toLocaleString()} sats ${direction === "in" ? "set aside" : "returned to spendable"}.`);
  };
  const createBucket = () => {
    const name = bucketName.trim();
    if (!name || buckets.some(bucket => bucket.name.toLowerCase() === name.toLowerCase())) return;
    const id=Date.now();setBuckets(old => [...old,{id,name,kind:bucketKind,balance:0,percent:0,reward:500,completions:0}]);
    setBucketName("");setSelectedBucket(id);setBucketNotice("");setBucketAmount("");
  };
  const sats = Number(amount);
  const validAmount = /^\d+$/.test(amount) && Number.isSafeInteger(sats) && sats > 0 && sats <= 100000000;
  const validRecipient = /^[A-Z]-\d{3,6}$/.test(recipient.trim().toUpperCase()) && recipient.trim().toUpperCase() !== "D-313";
  const openPayment = (next: Screen) => { setAmount(""); setRecipient(""); setNotice(""); setScreen(next); };
  const recordPayment = (kind: "sent" | "received") => {
    if (!validAmount || (kind === "sent" && (!validRecipient || sats > balance))) return;
    const cell = kind === "sent" ? recipient.trim().toUpperCase() : "Demo funding";
    if (kind === "received") {
      const split=allocateDeposit(sats,buckets);
      setBalance(value => value+split.spendable);
      setBuckets(old => old.map(bucket => ({...bucket,balance:bucket.balance+(split.allocations.find(a=>a.id===bucket.id)?.amount ?? 0)})));
      split.allocations.filter(a=>a.amount>0).forEach(a=>addHistory("allocated",`Deposit split · ${buckets.find(b=>b.id===a.id)?.name}`,a.amount));
    } else setBalance(value => value-sats);
    setTransactions(value => [{id: Date.now(), kind, cell, amount: sats, time: new Date().toLocaleString()}, ...value]);
    setNotice(kind === "sent" ? `Sent ${sats.toLocaleString()} demo sats to ${cell}.` : `Received ${sats.toLocaleString()} demo sats. ${buckets.some(b=>b.percent>0) ? "Your deposit split was applied." : ""}`);
    setAmount("");
  };

  return <main className="startup-stage">
    <div className="ambient-grid" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <section className={`phone-surface ${screen === "welcome" ? "modern-entrance" : ""}`} aria-live="polite">
      {screen === "welcome" && <div className="modern-welcome">
        <svg className="welcome-honeycomb" viewBox="0 0 440 860" fill="none" aria-hidden="true">
          <defs><linearGradient id="comb-gold" x1="0" y1="0" x2="440" y2="860" gradientUnits="userSpaceOnUse"><stop stopColor="#f6c768" stopOpacity=".25"/><stop offset=".5" stopColor="#bd8124" stopOpacity=".06"/><stop offset="1" stopColor="#f6c768" stopOpacity=".2"/></linearGradient></defs>
          <g stroke="url(#comb-gold)" strokeWidth="1.2"><path d="M-18 30 34 0 86 30v60l-52 30-52-30zM86 30l52-30 52 30v60l-52 30-52-30zM-70 120l52-30 52 30v60l-52 30-52-30zM346 136l52-30 52 30v60l-52 30-52-30zM398 226l52-30 52 30v60l-52 30-52-30zM-48 580l52-30 52 30v60L4 670l-52-30zM346 640l52-30 52 30v60l-52 30-52-30zM294 730l52-30 52 30v60l-52 30-52-30zM398 730l52-30 52 30v60l-52 30-52-30z"/></g>
        </svg>
        <header className="welcome-brand">
          <svg className="welcome-logo" viewBox="0 0 104 104" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round"><path d="M52 5 75 18v27L52 58 29 45V18z"/><path d="M29 45 52 58v27L29 98 6 85V58z"/><path d="M75 45 98 58v27L75 98 52 85V58z"/></g></svg>
          <h1>THE HIVE</h1>
          <p>PEOPLE <span>•</span> PAYMENTS <span>•</span> POSSIBILITIES</p>
        </header>
        <p className="welcome-promise">Small Payments.<br/><span>A Bigger World.</span></p>
        <div className="welcome-choices">
          <button className="welcome-choice choice-join" onClick={() => setScreen("join")}>
            <svg viewBox="0 0 208 218" fill="none" aria-hidden="true"><defs><linearGradient id="join-gold" x1="30" y1="15" x2="190" y2="210" gradientUnits="userSpaceOnUse"><stop stopColor="#ffe29a"/><stop offset=".52" stopColor="#f7c65e"/><stop offset="1" stopColor="#dca135"/></linearGradient></defs><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="url(#join-gold)" stroke="#ffdf8c" strokeWidth="1.2"/></svg>
            <span><strong>JOIN<br/>THE HIVE</strong><small>Send Bitcoin.<br/>Get Your Cell.</small></span>
          </button>
          <button className="welcome-choice choice-enter" onClick={() => setScreen("enter")}>
            <svg viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0b0d0a" fillOpacity=".85" stroke="#d7ad58" strokeWidth="1.5"/></svg>
            <span><strong>ENTER<br/>THE HIVE</strong><small>I already<br/>have a key.</small></span>
          </button>
        </div>
      </div>}

      {screen === "join" && <div className="flow-screen join-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 1 OF 3</p><h2>Join The Hive</h2><p className="flow-copy">Send bitcoin here</p>
        <div className="qr-frame"><svg className="qr-hex-outline" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="#d7ad58" strokeWidth="1.5"/></svg><div className="fake-qr" aria-label="Placeholder QR illustration, not a payment code"><QrCode/></div></div>
        <p className="payment-demo">Demo QR · No bitcoin will move</p>
        <div className="payment-fees fee-estimate" aria-label="Demo signup fee estimate">
          <div><span>Cell creation <small>(one time)</small></span><strong>$1.00</strong></div>
          <div><span>Bitcoin fees <small>(est.)</small></span><span>$0.70</span></div>
          <div><span>Lightning fees <small>(est.)</small></span><span>$0.10</span></div>
          <div className="fee-total"><span>Total <small>(est.)</small></span><strong>$1.80</strong></div>
          <span className="estimate-note">Demo estimates · USD equivalent</span>
          <FeesExplained/>
        </div>
        <div className="waiting"><span className="spinner"/><div><b>Waiting for your transaction…</b><small>This is a visual demo. No bitcoin will move.</small></div></div>
        <Button className="demo-forward" onClick={() => setScreen("creating")}>Transaction Received <span>Continue →</span></Button>
        <div className="progress"><span className="active">1<i>Send</i></span><span>2<i>Create</i></span><span>3<i>Receive keys</i></span></div>
      </div>}

      {screen === "creating" && <div className="flow-screen creating-screen">
        <button className="back" onClick={() => setScreen("join")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 2 OF 3</p><h2>Creating Your Hive</h2><p className="flow-copy">Your Bitcoin has been received. We’re setting up your Lightning wallet, Cell, and keys.</p>
        <div className="creation-emblem"><svg className="rounded-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="currentColor" strokeWidth="1.8"/></svg><HiveMark compact/></div>
        <div className="check-list"><p><span><Check/></span>Confirming transaction</p><p><span><Check/></span>Creating your wallet</p><p><span><Check/></span>Loading to Lightning</p><p><span className="working"><Check/></span>Generating your keys</p></div>
        <Button className="demo-forward" onClick={() => setScreen("keys")}>Finish Creating <span>Continue →</span></Button>
        <div className="progress"><span>1<i>Send</i></span><span className="active">2<i>Create</i></span><span>3<i>Receive keys</i></span></div>
      </div>}

      {screen === "keys" && <div className="flow-screen keys-screen">
        <button className="back" onClick={() => setScreen("creating")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 3 OF 3</p><h2>Your Hive is Ready</h2><p className="flow-copy">Save your keys. The private key gives access to your wallet; the public key lets others send to you.</p>
        <div className="key-pair"><div className="key-card private"><button className="mini-qr" aria-label="Open private key" onClick={() => setScreen("private-key")}><svg className="rounded-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="currentColor" strokeWidth="1.8"/></svg><QrCode/></button><b>PRIVATE KEY</b><small>Keep this secret. Save it somewhere safe.</small></div><div className="key-card public"><button className="mini-qr" aria-label="Open public key" onClick={() => setScreen("public-key")}><svg className="rounded-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="currentColor" strokeWidth="1.8"/></svg><QrCode/></button><b>PUBLIC KEY</b><small>Share this to receive sats.</small></div></div>
        <div className="cell-card"><span>Your Cell</span><strong>D-313 <Copy size={17}/></strong><small>This is your Hive identity.</small></div>
        <Button className="unlock" onClick={() => setScreen("home")}>I’ve Saved My Keys</Button>
        <p className="session-note">Demo keys only—nothing sensitive is being generated or stored.</p>
      </div>}

      {(screen === "private-key" || screen === "public-key") && <div className={`flow-screen key-detail-screen ${screen === "private-key" ? "private" : "public"}`}>
        <button className="back" onClick={() => setScreen("keys")} aria-label="Back to your keys"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">YOUR CELL · D-313</p>
        <h2>{screen === "private-key" ? "Your Private Key" : "Your Public Key"}</h2>
        <p className="flow-copy">{screen === "private-key" ? "Keep this private. Anyone with a real private key can access its wallet." : "Share your public key so others can find you."}</p>
        <div className="capture-key">
          <div className="capture-qr"><QrCode aria-label="Demo QR illustration, not a scannable wallet key"/></div>
          <span className="capture-label">{screen === "private-key" ? "PRIVATE KEY" : "PUBLIC KEY"} · DEMO</span>
          <code>{screen === "private-key" ? "DEMO-PRIVATE-KEY-D313-NOT-A-REAL-WALLET" : "DEMO-PUBLIC-KEY-D313-NOT-A-REAL-WALLET"}</code>
          <p>Demo QR illustration · Not a real wallet key</p>
        </div>
        <p className="capture-help">Take a screenshot to save this demo key screen.</p>
        <Button className="unlock" onClick={() => setScreen("keys")}>Back to My Keys</Button>
      </div>}

      {screen === "enter" && <div className="flow-screen enter-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="identity small"><HiveMark/><h1>THE HIVE</h1><p>PEOPLE <b>•</b> PAYMENTS <b>•</b> POSSIBILITIES</p></div>
        <h2>Enter The Hive</h2><p className="flow-copy">Paste or scan your private key to access your wallet.</p>
        <label className="key-field"><KeyRound size={19}/><Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your private key here…" aria-label="Private key"/><button aria-label="Scan private key"><QrCode size={20}/></button></label>
        <Button className="unlock" disabled={!key.trim()} onClick={() => setScreen("home")}>Unlock</Button>
        <p className="session-note"><Zap size={15}/> Your key is used only for this session and is never saved.</p>
      </div>}

      {(screen === "send" || screen === "receive") && <div className="flow-screen payment-screen">
        <button className="back" onClick={() => setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">DEMO WALLET · D-313</p><h2>{screen === "send" ? "Send sats" : "Receive sats"}</h2>
        <p className="flow-copy">{screen === "send" ? "Send a little love to another Cell." : "Create a demo request or add simulated funds."}</p>
        <div className="payment-panel">
          <p className="available-balance">Available: {balance.toLocaleString()} demo sats</p>
          {screen === "send" && <label className="payment-field">Recipient Cell<Input value={recipient} onChange={e => {setRecipient(e.target.value);setNotice("");}} placeholder="A-101" autoCapitalize="characters"/></label>}
          {screen === "receive" && <div className="receive-cell"><span>Your Cell</span><strong>D-313</strong><small>Share this Cell with the sender.</small></div>}
          <label className="payment-field">Amount in sats<Input inputMode="numeric" value={amount} onChange={e => {setAmount(e.target.value);setNotice("");}} placeholder="500"/></label>
          {amount && !validAmount && <p className="payment-error">Enter a whole number from 1 to 100,000,000 sats.</p>}
          {screen === "send" && recipient && !validRecipient && <p className="payment-error">Use a Cell such as A-101, other than your own.</p>}
          {screen === "send" && validAmount && sats > balance && <p className="payment-error">Your demo balance is too low.</p>}
          {screen === "receive" && validAmount && <div className="demo-request"><b>Demo payment request</b><code>HIVE-DEMO:D-313:{sats}</code><small>Text request only · Not a Lightning invoice</small></div>}
          <Button className="unlock" disabled={!validAmount || (screen === "send" && (!validRecipient || sats > balance))} onClick={() => recordPayment(screen === "send" ? "sent" : "received")}>{screen === "send" ? "Send demo sats" : "Simulate received payment"}</Button>
          {notice && <p className="payment-success" role="status"><Check size={18}/>{notice}</p>}
        </div>
        <p className="session-note">Demo only. No real bitcoin moves. Balance and history reset when this page reloads.</p>
      </div>}

      {screen === "activity" && <div className="flow-screen activity-screen">
        <button className="back" onClick={() => setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">DEMO WALLET · D-313</p><h2>Activity</h2><p className="flow-copy">{balance.toLocaleString()} sats available</p>
        <div className="activity-list">{transactions.length ? transactions.map(transaction => <article className="transaction-row" key={transaction.id}><div className="transaction-icon">{transaction.kind === "sent" ? <Send/> : <QrCode/>}</div><div><b>{transaction.kind === "sent" ? `To ${transaction.cell}` : transaction.cell}</b><small>{transaction.time}</small><small>{transaction.kind === "allocated" ? "Set aside · Internal" : transaction.kind === "released" ? "Returned · Internal" : "Completed · Demo"}</small></div><strong className={transaction.kind}>{(transaction.kind === "sent" || transaction.kind === "allocated") ? "−" : "+"}{transaction.amount.toLocaleString()}<small>sats</small></strong></article>) : <div className="activity-empty"><Clock3/><h3>No payments yet</h3><p>Send or receive demo sats to see them here.</p><Button onClick={() => openPayment("send")}>Send demo sats</Button></div>}</div>
        <p className="session-note">Simulated transactions · This session only</p>
      </div>}

      {screen === "buckets" && <div className="flow-screen buckets-screen">
        <button className="back" onClick={() => setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">ONE WALLET · YOUR PRIORITIES</p><h2>Your buckets</h2><p className="flow-copy">Small steps. Something to show for them.</p>
        <div className="bucket-summary"><div><small>Spendable</small><b>{balance.toLocaleString()}</b></div><div><small>Set aside</small><b>{reserved.toLocaleString()}</b></div><span>{totalBalance.toLocaleString()} demo sats in your wallet</span></div>
        <div className="bucket-grid">{buckets.map(bucket => <button className={`bucket-tile ${selectedBucket === bucket.id ? "selected" : ""}`} key={bucket.id} onClick={() => {setSelectedBucket(bucket.id);setBucketAmount("");setBucketNotice("");}}><svg viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="currentColor" strokeWidth="1.8"/></svg><span><small>{bucket.kind === "habit" ? "HABIT" : "SAVINGS"}</small><b>{bucket.name}</b><strong>{bucket.balance.toLocaleString()}</strong><small>sats · {bucket.percent}% of deposits</small></span></button>)}</div>
        {!buckets.length && <p className="bucket-empty">Create Running for habit rewards, or a family savings bucket to start setting sats aside.</p>}
        {selected && <section className="bucket-panel"><h3>{selected.name}</h3><p>{selected.kind === "habit" ? `${selected.completions} completions logged` : "Savings set aside inside your wallet"}</p>
          {selected.kind === "habit" && <><label className="payment-field">Reward per completion (sats)<Input inputMode="numeric" value={selected.reward} onChange={e=>{const n=Number(e.target.value);if(Number.isSafeInteger(n)&&n>=0&&n<=100000000)setBuckets(old=>old.map(b=>b.id===selected.id?{...b,reward:n}:b));}}/></label><Button className="bucket-primary" disabled={selected.reward<=0 || selected.reward>balance} onClick={()=>moveBucket("in",selected.reward,true)}>Log habit · Set aside {selected.reward.toLocaleString()} sats</Button>{selected.reward>balance && <p className="payment-error">Not enough spendable sats for this reward.</p>}</>}
          <label className="payment-field">Move sats<Input value={bucketAmount} inputMode="numeric" placeholder="500" onChange={e=>setBucketAmount(e.target.value)}/></label>
          <div className="bucket-transfer"><Button disabled={!validTransfer||transferAmount>balance} onClick={()=>moveBucket("in",transferAmount)}>Set aside</Button><Button variant="outline" disabled={!validTransfer||transferAmount>selected.balance} onClick={()=>moveBucket("out",transferAmount)}>Return to wallet</Button></div>
          {bucketNotice && <p className="payment-success" role="status">{bucketNotice}</p>}
          {selected.balance===0 && <button className="text-action" onClick={()=>{setBuckets(old=>old.filter(b=>b.id!==selected.id));setSelectedBucket(null);}}>Delete empty bucket</button>}
        </section>}
        <section className="bucket-panel"><h3>Create a bucket</h3><label className="payment-field">Name<Input maxLength={32} value={bucketName} onChange={e=>setBucketName(e.target.value)} placeholder="Running, College fund…"/></label><div className="bucket-kind"><button aria-pressed={bucketKind==="savings"} onClick={()=>setBucketKind("savings")}>Savings</button><button aria-pressed={bucketKind==="habit"} onClick={()=>setBucketKind("habit")}>Habit</button></div><Button className="bucket-primary" disabled={!bucketName.trim()||buckets.some(b=>b.name.toLowerCase()===bucketName.trim().toLowerCase())} onClick={createBucket}>Create bucket</Button></section>
        {!!buckets.length && <section className="bucket-panel"><h3>Split incoming deposits</h3><p>Choose a percentage for each bucket. The rest stays spendable. Applies to new deposits only.</p>{!editingRules ? <><p className="split-summary">{buckets.reduce((sum,b)=>sum+b.percent,0)}% set aside · {100-buckets.reduce((sum,b)=>sum+b.percent,0)}% spendable</p><Button variant="outline" onClick={()=>{setRuleDraft(Object.fromEntries(buckets.map(b=>[b.id,String(b.percent)])));setEditingRules(true);}}>Edit deposit split</Button></> : <><div className="split-fields">{buckets.map(bucket=><label key={bucket.id}>{bucket.name}<div><Input inputMode="numeric" value={ruleDraft[bucket.id]??String(bucket.percent)} onChange={e=>setRuleDraft(old=>({...old,[bucket.id]:e.target.value}))}/><span>%</span></div></label>)}</div><p className={rulesValid ? "split-summary" : "payment-error"}>{rulesValid ? `${100-draftTotal}% stays spendable` : "Use whole percentages totaling no more than 100%."}</p><div className="bucket-transfer"><Button disabled={!rulesValid} onClick={()=>{setBuckets(old=>old.map(b=>({...b,percent:Number(ruleDraft[b.id]??b.percent)})));setEditingRules(false);}}>Save split</Button><Button variant="outline" onClick={()=>setEditingRules(false)}>Cancel</Button></div></>}</section>}
        <p className="bucket-footnote">Buckets divide one wallet balance. They have no separate keys. Demo balances and habit history reset on reload.</p>
      </div>}

      {screen === "home" && <div className="flow-screen home-screen">
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <div className="cell-badge"><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><span>D-313</span><Copy size={16}/></div>
        <p className="home-label">YOUR CELL</p><h2>{balance.toLocaleString()} sats</h2><p className="fiat">Spendable · {reserved.toLocaleString()} sats in buckets</p><button className="bucket-entry" onClick={()=>setScreen("buckets")}>Your buckets <span>→</span></button>
        <div className="home-actions"><button onClick={() => openPayment("send")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Send/><span>Send</span></button><button onClick={() => openPayment("receive")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><QrCode/><span>Receive</span></button><button><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Users/><span>The Hive</span></button><button onClick={() => setScreen("activity")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Clock3/><span>Activity</span></button></div>
        <p className="wallet-motto">Every bit counts.</p>
        <button className="restart" onClick={() => { setKey(""); setScreen("welcome"); }}>Return to startup</button>
        <p className="custody-note"><ShieldCheck size={15}/> Your keys. Your control. Always.</p>
      </div>}
    </section>
  </main>;
}
