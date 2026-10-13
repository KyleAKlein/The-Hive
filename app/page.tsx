"use client";

import { useEffect, useRef, useState } from "react";
import { allocateDeposit } from "@/lib/bucket-math";
import { ArrowLeft, Check, Clock3, Copy, KeyRound, QrCode, Pencil, Plus, Send, ShieldCheck, Users, Zap } from "lucide-react";
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
  const [buckets, setBuckets] = useState<{id:number; name:string; kind:"habit" | "savings"; balance:number; percent:number; reward:number; completions:number; slot?:number}[]>([]);
  const [bucketName, setBucketName] = useState("");
  const [bucketKind, setBucketKind] = useState<"habit" | "savings">("savings");
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [bucketAmount, setBucketAmount] = useState("");
  const [bucketNotice, setBucketNotice] = useState("");
  const [ruleDraft, setRuleDraft] = useState<Record<number,string>>({});
  const [editingRules, setEditingRules] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [draggedBucket, setDraggedBucket] = useState<number | null>(null);
  const [dropBucket, setDropBucket] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    try {
      const saved=JSON.parse(localStorage.getItem("hive-demo-wallet-v1") ?? "null");
      if(saved && Number.isSafeInteger(saved.balance) && saved.balance>=0 && Array.isArray(saved.buckets) && saved.buckets.every((b: {id:number;name:string;kind:string;balance:number;percent:number;reward:number;completions:number})=>Number.isSafeInteger(b.id)&&typeof b.name==="string"&&(b.kind==="habit"||b.kind==="savings")&&Number.isSafeInteger(b.balance)&&b.balance>=0&&Number.isInteger(b.percent)&&b.percent>=0&&b.percent<=100&&Number.isSafeInteger(b.reward)&&b.reward>=0&&Number.isInteger(b.completions)&&b.completions>=0) && saved.buckets.reduce((sum:number,b:{percent:number})=>sum+b.percent,0)<=100) {
        setBalance(saved.balance);setBuckets(saved.buckets);
        if(Array.isArray(saved.transactions) && saved.transactions.every((t:{kind:string;amount:number;cell:string;time:string})=>["sent","received","allocated","released"].includes(t.kind)&&Number.isSafeInteger(t.amount)&&t.amount>0&&typeof t.cell==="string"&&typeof t.time==="string"))setTransactions(saved.transactions);
      }
    } catch { /* A fresh demo is safe if browser storage is unavailable. */ }
    setStorageReady(true);
    return ()=>{if(holdTimer.current)clearTimeout(holdTimer.current);};
  },[]);
  useEffect(()=>{if(storageReady)try{localStorage.setItem("hive-demo-wallet-v1",JSON.stringify({balance,buckets,transactions}));}catch{/* Session continues without browser storage. */}},[storageReady,balance,buckets,transactions]);
  const reorderBucket = (from:number,to:number) => setBuckets(old=>{
    const next=[...old], source=next.findIndex(b=>b.id===from),target=next.findIndex(b=>b.id===to);
    if(source<0||target<0||source===target)return old;
    const [item]=next.splice(source,1);next.splice(target,0,item);return next;
  });
  const cancelHold = ()=>{if(holdTimer.current)clearTimeout(holdTimer.current);holdTimer.current=null;};
  const DEMO_SATS_PER_DOLLAR = 1000;
  const [editBucketId, setEditBucketId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDeposit, setEditDeposit] = useState("1.00");
  const [depositUnit, setDepositUnit] = useState<"usd" | "sats">("usd");
  const [editSplit, setEditSplit] = useState("0");
  const [ghost, setGhost] = useState<{x:number;y:number;name:string} | null>(null);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  const pointerStart = useRef<{x:number;y:number} | null>(null);
  const dragId = useRef<number | null>(null);
  const positions = new Map<number,number>();
  buckets.forEach((b,i)=>{let slot=Number.isInteger(b.slot)&&b.slot!>=0&&b.slot!<100 ? b.slot! : i;while([...positions.values()].includes(slot))slot++;positions.set(b.id,slot);});
  let nextSlot=0;while([...positions.values()].includes(nextSlot))nextSlot++;
  const slotCount=Math.max(8,nextSlot+1,...[...positions.values()].map(slot=>slot+3));
  const formatDollars=(value:number)=>`$${(value/DEMO_SATS_PER_DOLLAR).toFixed(2)}`;
  const makeTile = ()=>{
    const id=Date.now();let n=buckets.length+1;while(buckets.some(b=>b.name===`Bucket ${n}`))n++;
    setBuckets(old=>[...old,{id,name:`Bucket ${n}`,kind:"savings",balance:0,percent:0,reward:1000,completions:0,slot:nextSlot}]);
    setBucketNotice("New bucket added. Tap its pencil to name it.");
  };
  const quickDeposit = (id:number)=>{
    const bucket=buckets.find(b=>b.id===id);if(!bucket)return;
    if(bucket.reward<=0||bucket.reward>balance){setBucketNotice("Not enough spendable sats for this deposit.");return;}
    setBalance(old=>old-bucket.reward);
    setBuckets(old=>old.map(b=>b.id===id?{...b,balance:b.balance+b.reward,completions:b.completions+(b.kind==="habit"?1:0)}:b));
    addHistory("allocated",bucket.name,bucket.reward);
    setBucketNotice(`${formatDollars(bucket.reward)} set aside in ${bucket.name}.`);
  };
  const placeTile = (id:number,slot:number)=>{
    const previous=positions.get(id);const occupant=buckets.find(b=>positions.get(b.id)===slot);
    setBuckets(old=>old.map(b=>({...b,slot:b.id===id?slot:occupant?.id===b.id?previous:positions.get(b.id)})));
  };
  const openTileEditor = (id:number)=>{const b=buckets.find(b=>b.id===id);if(!b)return;setEditBucketId(id);setEditLabel(b.name);setEditDeposit((b.reward/DEMO_SATS_PER_DOLLAR).toFixed(2));setDepositUnit("usd");setEditSplit(String(b.percent));setBucketAmount("");setBucketNotice("");};
  const edited=buckets.find(b=>b.id===editBucketId);
  const editSats=depositUnit==="usd"?Math.round(Number(editDeposit)*DEMO_SATS_PER_DOLLAR):Number(editDeposit);
  const validEdit=!!editLabel.trim() && !buckets.some(b=>b.id!==editBucketId&&b.name.toLowerCase()===editLabel.trim().toLowerCase()) && (depositUnit==="usd"?/^\d+(\.\d{1,2})?$/.test(editDeposit):/^\d+$/.test(editDeposit)) && Number.isSafeInteger(editSats)&&editSats>0&&editSats<=100000000 && /^\d+$/.test(editSplit)&&Number(editSplit)<=100 && buckets.filter(b=>b.id!==editBucketId).reduce((sum,b)=>sum+b.percent,0)+Number(editSplit)<=100;
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
        <p className="step">STEP 3 OF 3</p><h2>Save Your Keys</h2><p className="flow-copy key-save-instruction">Click and screen shot both of these</p><div className="key-save-arrows" aria-hidden="true"><svg viewBox="0 0 300 42" fill="none"><path d="M130 3C105 3 78 10 72 33M62 23l10 12 12-9M170 3c25 0 52 7 58 30m-12-7 12 9 10-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <div className="key-pair"><div className="key-card private"><button className="mini-qr" aria-label="Open private key" onClick={() => setScreen("private-key")}><svg className="rounded-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="currentColor" strokeWidth="1.8"/></svg><QrCode/></button><b>PRIVATE KEY</b><small>Your access key. Keep it private.</small></div><div className="key-card public"><button className="mini-qr" aria-label="Open public key" onClick={() => setScreen("public-key")}><svg className="rounded-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="currentColor" strokeWidth="1.8"/></svg><QrCode/></button><b>PUBLIC KEY</b><small>Your receiving key. Share it to get sats.</small></div></div>
        <div className="cell-card"><span>Your Cell</span><strong>D-313 <Copy size={17}/></strong><small>This is your Hive identity.</small></div>
        <Button className="unlock" onClick={() => setScreen("home")}>I’ve Saved My Keys</Button>
        <p className="session-note">Demo keys only—nothing sensitive is being generated or stored.</p>
      </div>}

      {(screen === "private-key" || screen === "public-key") && <div className={`flow-screen key-detail-screen clean-key-screen ${screen === "private-key" ? "private" : "public"}`}>
        <button className="back" onClick={() => setScreen("keys")} aria-label="Back to your keys"><ArrowLeft/></button>
        <h2>{screen === "private-key" ? "Private key" : "Public key"}</h2>
        <div className="key-snapshot-hex">
          <svg className="key-snapshot-outline" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090c08" stroke="currentColor" strokeWidth="5"/></svg>
          <div className="key-snapshot-qr"><QrCode aria-label="Placeholder QR illustration"/></div>
        </div>
        <code className="key-snapshot-text">{screen === "private-key" ? "DEMO-PRIVATE-KEY-D313-NOT-A-REAL-WALLET" : "DEMO-PUBLIC-KEY-D313-NOT-A-REAL-WALLET"}</code>
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
        <p className="session-note">Demo only. No real bitcoin moves. Demo balance and history are saved on this browser.</p>
      </div>}

      {screen === "activity" && <div className="flow-screen activity-screen">
        <button className="back" onClick={() => setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">DEMO WALLET · D-313</p><h2>Activity</h2><p className="flow-copy">{balance.toLocaleString()} sats available</p>
        <div className="activity-list">{transactions.length ? transactions.map(transaction => <article className="transaction-row" key={transaction.id}><div className="transaction-icon">{transaction.kind === "sent" ? <Send/> : <QrCode/>}</div><div><b>{transaction.kind === "sent" ? `To ${transaction.cell}` : transaction.cell}</b><small>{transaction.time}</small><small>{transaction.kind === "allocated" ? "Set aside · Internal" : transaction.kind === "released" ? "Returned · Internal" : "Completed · Demo"}</small></div><strong className={transaction.kind}>{(transaction.kind === "sent" || transaction.kind === "allocated") ? "−" : "+"}{transaction.amount.toLocaleString()}<small>sats</small></strong></article>) : <div className="activity-empty"><Clock3/><h3>No payments yet</h3><p>Send or receive demo sats to see them here.</p><Button onClick={() => openPayment("send")}>Send demo sats</Button></div>}</div>
        <p className="session-note">Simulated transactions · Saved on this browser</p>
      </div>}

      {screen === "buckets" && <div className="flow-screen tile-wallet-screen">
        <button className="back" onClick={()=>{setScreen("home");setEditBucketId(null);}} aria-label="Back to hub"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <div className="wallet-root-tile"><svg viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="currentColor" stroke="currentColor" strokeWidth="1.8"/></svg><span><small>MY CELL</small><strong>D-313</strong><small>{balance.toLocaleString()} sats</small></span></div>
        <p className="tile-wallet-total">{formatDollars(balance)} spendable <span>· {formatDollars(reserved)} in buckets</span></p>
        <div className="tile-grid-tools"><span>Tap to deposit · Pencil to edit</span><button onClick={()=>setArranging(!arranging)}>{arranging?"Done":"Arrange"}</button></div>
        <div className={`honeycomb-canvas ${arranging?"arrange-active":""}`} style={{aspectRatio:`2.5 / ${Math.ceil(slotCount/2)*.79+ .25}`}}>
          {Array.from({length:slotCount},(_,slot)=>{
            const bucket=buckets.find(b=>positions.get(b.id)===slot);
            const isPlus=slot===nextSlot;
            return <div key={slot} data-grid-slot={slot} className={`honeycomb-slot ${targetSlot===slot?"snap-target":""}`} style={{left:`${(slot%2)*40+(Math.floor(slot/2)%2)*20}%`,top:`${Math.floor(slot/2)*100/(Math.ceil(slotCount/2)*.79+.25)*.79}%`}}>
              <div className="grid-outline"><svg viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="currentColor" stroke="currentColor" strokeWidth="1.8"/></svg></div>
              {bucket ? <div className={`wallet-bucket-tile ${draggedBucket===bucket.id?"dragging":""}`}>
                <button className="bucket-face" aria-label={`${bucket.name}, ${bucket.balance} sats. Deposit ${formatDollars(bucket.reward)}`} onPointerDown={e=>{
                  suppressClick.current=false;pointerStart.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);
                  const begin=()=>{dragId.current=bucket.id;setDraggedBucket(bucket.id);setGhost({x:e.clientX,y:e.clientY,name:bucket.name});suppressClick.current=true;};
                  if(arranging)begin();else holdTimer.current=setTimeout(begin,400);
                }} onPointerMove={e=>{
                  if(dragId.current!==null){setGhost({x:e.clientX,y:e.clientY,name:bucket.name});const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-grid-slot]");setTargetSlot(slot?Number(slot.getAttribute("data-grid-slot")):null);}
                  else if(pointerStart.current&&Math.hypot(e.clientX-pointerStart.current.x,e.clientY-pointerStart.current.y)>8)cancelHold();
                }} onPointerUp={e=>{cancelHold();if(dragId.current!==null){const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-grid-slot]");if(slot)placeTile(dragId.current,Number(slot.getAttribute("data-grid-slot")));suppressClick.current=true;}dragId.current=null;setDraggedBucket(null);setGhost(null);setTargetSlot(null);}}
                  onPointerCancel={()=>{cancelHold();dragId.current=null;setDraggedBucket(null);setGhost(null);setTargetSlot(null);}}
                  onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}if(arranging)openTileEditor(bucket.id);else quickDeposit(bucket.id);}}>
                  <svg viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="currentColor" stroke="currentColor" strokeWidth="1.8"/></svg><span><b>{bucket.name}</b><strong>{formatDollars(bucket.balance)}</strong><small>{bucket.balance.toLocaleString()} sats</small><em>+ {formatDollars(bucket.reward)}</em></span>
                </button>
                <button className="tile-edit" aria-label={`Edit ${bucket.name}`} onClick={()=>openTileEditor(bucket.id)}><Pencil size={14}/></button>
              </div> : isPlus ? <button className="add-bucket-tile" onClick={makeTile} aria-label="Create bucket"><svg viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="currentColor" stroke="currentColor" strokeWidth="1.8"/></svg><span><Plus/><small>Add bucket</small></span></button> : null}
            </div>;
          })}
        </div>
        {ghost && <div className="tile-drag-ghost" style={{left:ghost.x,top:ghost.y}}><svg viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="currentColor" stroke="currentColor" strokeWidth="1.8"/></svg><span>{ghost.name}</span></div>}
        {bucketNotice && <p className="tile-notice" role="status">{bucketNotice}</p>}
        <p className="tile-wallet-note">Every bit counts.<small>Demo · $1 = 1,000 sats</small></p>
        {edited && <div className="tile-editor-backdrop" onClick={()=>setEditBucketId(null)}><section className="tile-editor" role="dialog" aria-modal="true" aria-label="Edit bucket" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape")setEditBucketId(null);}}>
          <div className="tile-editor-heading"><h2>Edit bucket</h2><button aria-label="Close bucket editor" onClick={()=>setEditBucketId(null)}>×</button></div>
          <label className="payment-field">Label<Input autoFocus maxLength={32} value={editLabel} onChange={e=>setEditLabel(e.target.value)}/></label>
          <label className="payment-field">Standard deposit<Input inputMode="decimal" value={editDeposit} onChange={e=>setEditDeposit(e.target.value)}/></label>
          <div className="bucket-kind"><button aria-pressed={depositUnit==="usd"} onClick={()=>{setDepositUnit("usd");setEditDeposit((edited.reward/DEMO_SATS_PER_DOLLAR).toFixed(2));}}>USD</button><button aria-pressed={depositUnit==="sats"} onClick={()=>{setDepositUnit("sats");setEditDeposit(String(edited.reward));}}>Sats</button></div>
          <p className="tile-editor-help">Demo rate: $1 = 1,000 sats. Tap the tile to move its preset from your spendable balance.</p>
          <details className="tile-advanced"><summary>More options</summary>
            <label className="payment-field">Share of incoming deposits (%)<Input inputMode="numeric" value={editSplit} onChange={e=>setEditSplit(e.target.value)}/></label>
            <div className="bucket-kind"><button aria-pressed={edited.kind==="savings"} onClick={()=>setBuckets(old=>old.map(b=>b.id===edited.id?{...b,kind:"savings"}:b))}>Savings</button><button aria-pressed={edited.kind==="habit"} onClick={()=>setBuckets(old=>old.map(b=>b.id===edited.id?{...b,kind:"habit"}:b))}>Habit</button></div>
            {edited.kind==="habit"&&<p className="tile-editor-help">{edited.completions} completions · Each tap logs a habit reward.</p>}
            <div className="bucket-transfer"><Button variant="outline" onClick={()=>placeTile(edited.id,Math.max(0,(positions.get(edited.id)??0)-1))}>Move earlier</Button><Button variant="outline" onClick={()=>placeTile(edited.id,Math.min(99,(positions.get(edited.id)??0)+1))}>Move later</Button></div>
            <button className="text-action" disabled={edited.balance===0} onClick={()=>{setBalance(old=>old+edited.balance);setBuckets(old=>old.map(b=>b.id===edited.id?{...b,balance:0}:b));addHistory("released",edited.name,edited.balance);}}>Return {edited.balance.toLocaleString()} sats to wallet</button>
            <button className="text-action delete-tile" onClick={()=>{if(edited.balance>0){setBalance(old=>old+edited.balance);addHistory("released",`Deleted bucket · ${edited.name}`,edited.balance);}setBuckets(old=>old.filter(b=>b.id!==edited.id));setEditBucketId(null);}}>Delete bucket{edited.balance>0?" and return its sats":""}</button>
          </details>
          {!validEdit&&<p className="payment-error">Use a unique label, a positive deposit, and split percentages totaling no more than 100%.</p>}
          <Button className="bucket-primary" disabled={!validEdit} onClick={()=>{setBuckets(old=>old.map(b=>b.id===edited.id?{...b,name:editLabel.trim(),reward:editSats,percent:Number(editSplit)}:b));setEditBucketId(null);}}>Save</Button>
        </section></div>}
      </div>}

      {screen === "home" && <div className="flow-screen home-screen">
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <button className="cell-badge" aria-label="Open My Wallet and buckets" onClick={()=>setScreen("buckets")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><span>D-313</span><small>My Wallet</small></button>
        <p className="home-label">YOUR CELL · D-313</p><h2>{balance.toLocaleString()} sats</h2><p className="fiat">Spendable · {reserved.toLocaleString()} sats in buckets</p>
        <div className="home-actions"><button onClick={() => openPayment("send")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Send/><span>Send</span></button><button onClick={() => openPayment("receive")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><QrCode/><span>Receive</span></button><button><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Users/><span>The Hive</span></button><button onClick={() => setScreen("activity")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Clock3/><span>Activity</span></button></div>
        <p className="wallet-motto">Every bit counts.</p>
        <button className="restart" onClick={() => { setKey(""); setScreen("welcome"); }}>Return to startup</button>
        <p className="custody-note"><ShieldCheck size={15}/> Your keys. Your control. Always.</p>
      </div>}
    </section>
  </main>;
}
