"use client";

import { useEffect, useRef, useState } from "react";
import HiveWallet from "@/components/hive-wallet";
import LightningWallet from "@/components/lightning-wallet";
import { allocateDeposit } from "@/lib/bucket-math";
import { createHiveKeyPair, createRecovery } from "@/lib/hive-wallet";
import { ArrowLeft, Check, Clock3, Copy, KeyRound, QrCode, Pencil, Plus, ArrowUpDown, Send, ShieldCheck, Users, Zap, Search, Bookmark, Mail, MapPin, CalendarDays, Trophy, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";

type Screen = "welcome" | "join" | "creating" | "keys" | "enter" | "home" | "private-key" | "public-key" | "send" | "receive" | "activity" | "buckets" | "directory" | "profile" | "town" | "my-profile" | "member" | "invoice" | "lightning" | "hive-wallet";

function HiveMark({ compact = false }: { compact?: boolean }) {
  return <svg className={`hive-mark ${compact ? "compact" : ""}`} viewBox="0 0 104 104" fill="none" role="img" aria-label="The Hive logo"><g stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round"><path d="M52 5 75 18v27L52 58 29 45V18z"/><path d="M29 45 52 58v27L29 98 6 85V58z"/><path d="M75 45 98 58v27L75 98 52 85V58z"/></g></svg>;
}

function HexFrame() {
  return <svg className="send-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#10140c" stroke="currentColor" strokeWidth="1.8"/></svg>;
}

type HoneyIconKind = "dot" | "drop" | "cell" | "four" | "dipper" | "comb";
function HoneyAmountIcon({kind}: {kind: HoneyIconKind}) {
  const cell=(x:number,y:number,r:number,key:number)=><path key={key} d={`M${x} ${y-r}l${r*.866} ${r*.5}v${r}l${-r*.866} ${r*.5}l${-r*.866} ${-r*.5}v${-r}Z`}/>;
  return <svg className={`honey-amount-icon honey-${kind}`} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    {kind==="dot"&&<><circle cx="20" cy="22" r="6" fill="currentColor" stroke="none"/><path d="M18 19h1" stroke="#fff0c9" strokeWidth="2" strokeLinecap="round"/></>}
    {kind==="drop"&&<><path d="M20 6c-2 6-10 13-10 20a10 10 0 0020 0C30 19 22 12 20 6Z" fill="currentColor" stroke="none"/><path d="M15 24c-1 3 0 5 2 6" stroke="#fff0c9" strokeWidth="2" strokeLinecap="round"/></>}
    {kind==="cell"&&<g stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity=".22">{cell(20,20,13,0)}<path d="M14 17v7l6 3" fill="none" stroke="#edce91" strokeWidth="1.5"/></g>}
    {kind==="four"&&<g stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity=".2">{[[13,12],[26,19.5],[13,27],[26,34.5]].map(([x,y],i)=>cell(x,y-3,7.5,i))}</g>}
    {kind==="dipper"&&<g transform="rotate(-38 20 20)" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v14"/><rect x="12" y="5" width="16" height="16" rx="5" fill="currentColor" fillOpacity=".2"/><path d="M13 10h14M12 15h16"/><path d="M27 22c0 3 3 5 3 7a3 3 0 01-6 0c0-2 3-4 3-7Z" fill="currentColor" stroke="none"/></g>}
    {kind==="comb"&&<g stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity=".25">{[[20,20],[20,8],[30.4,14],[30.4,26],[20,32],[9.6,26],[9.6,14]].map(([x,y],i)=>cell(x,y,6,i))}</g>}
  </svg>;
}

function Instagram({size=18}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>}
function Youtube({size=18}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3Z" fill="currentColor" stroke="none"/></svg>}
function DirectoryAvatar({cell,anonymous}:{cell:string;anonymous:boolean}) {
 const n=Number(cell.replace(/\D/g,""));
 const tones=["#c38c63","#e0b58d","#986347","#d7a382"];
 return <span className={`directory-hex-avatar ${anonymous?"is-anonymous":""}`} aria-hidden="true">{anonymous?<Users size={21}/>:<svg viewBox="0 0 48 52" fill="none"><rect width="48" height="52" fill={["#3b5144","#514435","#3d485a","#534755"][n%4]}/><circle cx="35" cy="12" r="17" fill="#e3c482" opacity=".12"/><path d="M4 55v-8c0-13 9-20 20-20s20 7 20 20v8" fill={["#182a25","#242129","#273831"][n%3]}/><path d="M20 26v9q4 5 8 0v-9" fill={tones[n%4]}/><ellipse cx="24" cy="20" rx="10" ry="13" fill={tones[n%4]}/><path d={n%2?"M14 20V12q1-9 11-8 11 0 10 16l-5-8q-7 4-13 1Z":"M13 27V15q0-12 12-11 12 0 11 13v12l-4-2V14q-10 3-15-1v14Z"} fill="#29231f"/><circle cx="20" cy="19" r=".9" fill="#29231f"/><circle cx="28" cy="19" r=".9" fill="#29231f"/><path d="M21 25q3 3 6 0" stroke="#f8ddbc" strokeWidth="1.1" strokeLinecap="round"/></svg>}</span>;
}
function ShowFlyer(){return <div className="show-flyer"><span className="flyer-kicker">THE LATE SET PRESENTS</span><strong>GOOD<br/>QUESTION.</strong><span className="flyer-sub">A NIGHT OF STAND-UP</span><div className="flyer-mic"><svg viewBox="0 0 80 90" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="3"><rect x="28" y="5" width="24" height="42" rx="12"/><path d="M21 32v7a19 19 0 0038 0v-7M40 58v23M24 82h32M29 19h22M29 27h22"/></g></svg></div><span className="flyer-name">WITH MARCUS REED & FRIENDS</span><b>SAT · OCT 17 · 8 PM</b><span className="flyer-venue">THE HONEY ROOM · LAS VEGAS</span></div>}

const MOCK_ACTIVITY: {id:number;kind:"sent"|"received"|"allocated"|"released";cell:string;amount:number;time:string}[] = [
{id:101,kind:"received",cell:"D-117 · Marcus Reed",amount:100,time:"Today · 9:42 AM"},
{id:102,kind:"sent",cell:"D-042 · Open mic tip",amount:250,time:"Today · 9:35 AM"},
{id:103,kind:"allocated",cell:"Rainy day bucket",amount:1000,time:"Today · 9:20 AM"},
{id:104,kind:"received",cell:"Demo wallet funding",amount:24000,time:"Today · 9:18 AM"},
{id:105,kind:"sent",cell:"D-090 · Coffee",amount:6000,time:"Yesterday · 6:10 PM"},
{id:106,kind:"released",cell:"Weekend bucket",amount:1000,time:"Yesterday · 6:02 PM"},
{id:107,kind:"sent",cell:"D-226 · Honey dot tip",amount:20,time:"Yesterday · 5:45 PM"},
{id:108,kind:"received",cell:"D-008 · Thank you tip",amount:1000,time:"Yesterday · 4:30 PM"}
];

const DEMO_SATS_PER_DOLLAR = 1000;

export default function Home() {
  const [walletIntent,setWalletIntent]=useState<"join"|"restore"|null>(null);
  const [walletRecovery,setWalletRecovery]=useState("");
  const [walletKeys,setWalletKeys]=useState<{privateKey:string;publicKey:string}|null>(null);
  const [backupRequest,setBackupRequest]=useState(0);
  const [walletConnected,setWalletConnected]=useState(false);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [townLedger,setTownLedger]=useState(false);
  const [cellSearch,setCellSearch]=useState("");
  const [searchError,setSearchError]=useState("");
  const [savedCell,setSavedCell]=useState(false);
  const [flyerOpen,setFlyerOpen]=useState(false);
  const [profileNotice,setProfileNotice]=useState("");
  const [anonymous,setAnonymous]=useState(false);
  const [privacyReady,setPrivacyReady]=useState(false);
  const [profileName,setProfileName]=useState("Kyle Klein");
  const [profileTag,setProfileTag]=useState("Hive member");
  const [profileCell,setProfileCell]=useState("D-313");
  const [selectedMember,setSelectedMember]=useState("D-042");
  useEffect(()=>{let cancelled=false;(async()=>{try{const response=await fetch("/api/profile",{cache:"no-store"});if(!response.ok)throw new Error("profile unavailable");const body=await response.json() as {profile?:{name?:string;tag?:string;cellNumber?:string;anonymous?:boolean}};if(cancelled)return;const profile=body.profile;if(profile){if(profile.name)setProfileName(profile.name);if(profile.tag)setProfileTag(profile.tag);if(profile.cellNumber)setProfileCell(profile.cellNumber);setAnonymous(Boolean(profile.anonymous));}}catch{try{setAnonymous(localStorage.getItem("hive-profile-anonymous")==="true");}catch{}}finally{if(!cancelled)setPrivacyReady(true);}})();return()=>{cancelled=true;};},[]);
  useEffect(()=>{if(!privacyReady)return;try{localStorage.setItem("hive-profile-anonymous",String(anonymous));}catch{}void fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({anonymous})}).catch(()=>undefined);},[anonymous,privacyReady]);
  const directoryMembers=[{cell:"D-008",name:"Anonymous Cell",tag:""},{cell:"D-042",name:"Avery Chen",tag:"Poet"},{cell:"D-090",name:"Jordan Ellis",tag:"Musician"},{cell:"D-117",name:"Marcus Reed",tag:"Comedian"},{cell:"D-226",name:"Sam Rivera",tag:"Skater"},{cell:profileCell,name:anonymous?"Anonymous Cell":profileName,tag:anonymous?"":profileTag},{cell:"D-405",name:"Anonymous Cell",tag:""}];
  const visibleMembers=directoryMembers.filter(m=>`${m.name} ${m.cell} ${m.tag}`.toLowerCase().includes(cellSearch.trim().toLowerCase()));
  const openMember=(cell:string)=>{if(cell==="D-117")setScreen("profile");else if(cell===profileCell)setScreen("my-profile");else{setSelectedMember(cell);setScreen("member");}};
  const lookupCell=()=>{if(visibleMembers.length===1)openMember(visibleMembers[0].cell);};
  const member=directoryMembers.find(m=>m.cell===selectedMember)!;
  const [key, setKey] = useState("");
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:"instant"});},[screen]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const copyKey = async (kind:"private" | "public") => {
    const value=kind==="private"?walletKeys?.privateKey:walletKeys?.publicKey;
    if(!value){setCopyError("Create your keys first.");return;}
    try {await navigator.clipboard.writeText(value);setCopiedKey(kind);setCopyError("");}
    catch {setCopyError("Select the key text to copy it manually.");}
  };

  const createWalletKeys=()=>{
    const recovery=createRecovery();
    setWalletRecovery(recovery);
    setWalletKeys(null);
    setCopiedKey(null);
    setCopyError("");
    setWalletIntent("join");
    setScreen("hive-wallet");
  };

  const [invoiceValue,setInvoiceValue]=useState("");
  const [invoiceUnit,setInvoiceUnit]=useState<"usd"|"sats">("usd");
  const [invoiceNote,setInvoiceNote]=useState("");
  const [invoiceTo,setInvoiceTo]=useState("");
  const [invoiceExpiry,setInvoiceExpiry]=useState("60");
  const [invoiceMessage,setInvoiceMessage]=useState("");
  const [invoiceDraft,setInvoiceDraft]=useState<{id:string;sats:number;note:string;expires:number;to:string;sent:boolean;paid:boolean}|null>(null);
  const [demoInvoices,setDemoInvoices]=useState<{id:string;sats:number;note:string;expires:number;to:string;sent:boolean;paid:boolean}[]>([]);
  const [invoiceReady,setInvoiceReady]=useState(false);
  useEffect(()=>{try{const v=JSON.parse(localStorage.getItem("hive-demo-invoices")||"[]");if(Array.isArray(v))setDemoInvoices(v.filter(x=>typeof x.id==="string"&&Number.isSafeInteger(x.sats)&&x.sats>0&&typeof x.note==="string"&&typeof x.to==="string"&&typeof x.expires==="number"&&typeof x.sent==="boolean"&&typeof x.paid==="boolean"));}catch{}setInvoiceReady(true);},[]);
  useEffect(()=>{if(invoiceReady)try{localStorage.setItem("hive-demo-invoices",JSON.stringify(demoInvoices));}catch{}},[demoInvoices,invoiceReady]);
  const invoiceSats=invoiceUnit==="usd"?Math.round(Number(invoiceValue)*DEMO_SATS_PER_DOLLAR):Number(invoiceValue);
  const invoiceValid=(invoiceUnit==="usd"?/^\d+(\.\d{1,2})?$/:/^\d+$/).test(invoiceValue)&&Number.isSafeInteger(invoiceSats)&&invoiceSats>0&&invoiceSats<=100000000;
  const invoiceText=invoiceDraft?`HIVE-DEMO-INVOICE:${invoiceDraft.id}:D-313:${invoiceDraft.sats}:${invoiceDraft.expires}:${encodeURIComponent(invoiceDraft.note)}`:"";
  const copyReceive=async(value:string)=>{try{await navigator.clipboard.writeText(value);setInvoiceMessage("Copied.");}catch{setInvoiceMessage("Copy unavailable. Select the text above to copy it.");}};
  const startInvoice=()=>{setInvoiceDraft(null);setInvoiceValue("");setInvoiceNote("");setInvoiceTo("");setInvoiceMessage("");setScreen("invoice");};
  const createInvoice=()=>{if(!invoiceValid)return;const v={id:crypto.randomUUID(),sats:invoiceSats,note:invoiceNote.trim(),expires:Date.now()+Number(invoiceExpiry)*60000,to:"",sent:false,paid:false};setInvoiceDraft(v);setDemoInvoices(old=>[v,...old]);setInvoiceMessage("");};
  const sendInvoice=()=>{const to=invoiceTo.trim().toUpperCase();if(!/^[A-Z]{1,3}-\d{1,6}(?:-\d{1,6})?$/.test(to)||to==="D-313"){setInvoiceMessage("Enter another Cell, such as D-117.");return;}if(!invoiceDraft||invoiceDraft.expires<=Date.now())return;const v={...invoiceDraft,to,sent:true};setInvoiceDraft(v);setDemoInvoices(old=>old.map(x=>x.id===v.id?v:x));setInvoiceMessage(`Demo invoice addressed to ${to}. Saved locally; no message is delivered to another device.`);};
  const [balance, setBalance] = useState(21340);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [transactions, setTransactions] = useState<{id: number; kind: "sent" | "received" | "allocated" | "released"; cell: string; amount: number; time: string}[]>(MOCK_ACTIVITY);
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
        if(Array.isArray(saved.transactions) && saved.transactions.every((t:{kind:string;amount:number;cell:string;time:string})=>["sent","received","allocated","released"].includes(t.kind)&&Number.isSafeInteger(t.amount)&&t.amount>0&&typeof t.cell==="string"&&typeof t.time==="string"))setTransactions([...saved.transactions,...MOCK_ACTIVITY.filter(m=>!saved.transactions.some((t:{id:number})=>t.id===m.id))]);
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
  const [destinationMode,setDestinationMode]=useState<"cell"|"public"|"qr">("cell");
  const [sendUnit,setSendUnit]=useState<"usd"|"sats">("usd");
  const [sendInput,setSendInput]=useState("");
  const setSendValue=(value:string,unit:"usd"|"sats"=sendUnit)=>{
    setSendInput(value);setNotice("");
    const valid=unit==="usd"?/^\d+(\.\d{1,2})?$/.test(value):/^\d+$/.test(value);
    const n=unit==="usd"?Math.round(Number(value)*DEMO_SATS_PER_DOLLAR):Number(value);
    setAmount(valid&&Number.isSafeInteger(n)&&n>0?String(n):"");
  };
  const swapSendUnit=()=>{const next=sendUnit==="usd"?"sats":"usd";setSendUnit(next);setSendValue(amount ? next==="sats"?amount:(Number(amount)/DEMO_SATS_PER_DOLLAR).toFixed(2) : "",next);};
  const validRecipient = destinationMode==="public" ? recipient.trim().length>=8 : /^[A-Z]-\d{3,6}$/.test(recipient.trim().toUpperCase()) && recipient.trim().toUpperCase() !== "D-313";
  const openPayment = (next: Screen) => { setAmount(""); setRecipient(""); setNotice(""); setSendInput(""); setSendUnit("usd"); setDestinationMode("cell"); setScreen(next); };
  const recordPayment = (kind: "sent" | "received") => {
    if (!validAmount || (kind === "sent" && (!validRecipient || sats > balance))) return;
    const cell = kind === "sent" ? destinationMode==="public" ? recipient.trim() : recipient.trim().toUpperCase() : "Demo funding";
    if (kind === "received") {
      const split=allocateDeposit(sats,buckets);
      setBalance(value => value+split.spendable);
      setBuckets(old => old.map(bucket => ({...bucket,balance:bucket.balance+(split.allocations.find(a=>a.id===bucket.id)?.amount ?? 0)})));
      split.allocations.filter(a=>a.amount>0).forEach(a=>addHistory("allocated",`Deposit split · ${buckets.find(b=>b.id===a.id)?.name}`,a.amount));
    } else setBalance(value => value-sats);
    setTransactions(value => [{id: Date.now(), kind, cell, amount: sats, time: new Date().toLocaleString()}, ...value]);
    setNotice(kind === "sent" ? `Sent ${sats.toLocaleString()} demo sats to ${cell}.` : `Received ${sats.toLocaleString()} demo sats. ${buckets.some(b=>b.percent>0) ? "Your deposit split was applied." : ""}`);
    setAmount("");setSendInput("");
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
            <span><strong>JOIN<br/>THE HIVE</strong><small>Start a<br/>Bitcoin wallet.</small></span>
          </button>
          <button className="welcome-choice choice-enter" onClick={() => {setWalletIntent("restore");setScreen("hive-wallet");}}>
            <svg viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0b0d0a" fillOpacity=".85" stroke="#d7ad58" strokeWidth="1.5"/></svg>
            <span><strong>ENTER<br/>THE HIVE</strong><small>Restore my<br/>Bitcoin wallet.</small></span>
          </button>
        </div>
        <button className="restart welcome-demo-link" onClick={()=>setScreen("home")}>Explore the demo</button>
        <details className="welcome-about">
          <summary>What is the hive?</summary>
          <p>The hive is an instant bitcoin wallet built on the lightning network that allows sending/receiving bitcoin.</p>
        </details>
      </div>}

      {<div hidden={screen!=="hive-wallet"} className="flow-screen"><HiveWallet intent={walletIntent} initialRecovery={walletRecovery} backupRequest={backupRequest} onConnectionChange={setWalletConnected} onBack={()=>{if(walletIntent==="restore"){setWalletIntent(null);setScreen("welcome");}else setScreen("home");}} onOpenApp={()=>setScreen("home")} onFundingComplete={()=>{setWalletKeys(createHiveKeyPair(walletRecovery));setScreen("keys");}}/></div>}
      {screen === "join" && <div className="flow-screen join-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 1 OF 3</p><h2>Join The Hive</h2><p className="flow-copy">Create your wallet by sending bitcoin to this wallet address (QR code).</p>
        <p className="join-fee-copy">Please send an amount more than the fees stated below</p>
        <p className="join-fee-note">The exact Breez fee is shown with the Lightning QR. Back up your 12 words later from My Cell.</p>
        <div className="creation-emblem"><svg className="rounded-hex-frame" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090a08" stroke="currentColor" strokeWidth="1.8"/></svg><KeyRound/></div>
        <div className="check-list"><p><span><Check/></span>The $5 stays in your wallet</p><p><span><Check/></span>Generated with secure browser randomness</p><p><span><Check/></span>Private keys stay on this device</p></div>
        <Button className="demo-forward" onClick={createWalletKeys}>Create my wallet <span>Continue →</span></Button>
        <div className="progress"><span className="active">1<i>Create</i></span><span>2<i>Fund</i></span><span>3<i>Keys</i></span></div>
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

      {screen === "keys" && walletKeys && <div className="flow-screen keys-screen">
        <button className="back" onClick={() => setScreen(walletConnected ? "hive-wallet" : "join")} aria-label="Back"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="step">STEP 3 OF 3</p><h2>Save Your Hive Identity Keys</h2><p className="flow-copy key-save-instruction">Payment confirmed. Open and screen shot both QR codes. Keep the private screenshot out of cloud backups.</p><div className="key-save-arrows" aria-hidden="true"><svg viewBox="0 0 300 42" fill="none"><path d="M130 3C105 3 78 10 72 33M62 23l10 12 12-9M170 3c25 0 52 7 58 30m-12-7 12 9 10-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <div className="key-pair"><div className="key-card private"><button className="mini-qr real-key-qr" aria-label="Open Hive identity private key" onClick={() => setScreen("private-key")}><QRCodeSVG value={walletKeys.privateKey} size={112} marginSize={2}/></button><b>PRIVATE KEY</b><small>Secret Hive identity key. It does not replace your 12-word wallet backup.</small><div className="inline-key-copy"><code>{walletKeys.privateKey}</code><button onClick={()=>copyKey("private")} aria-label="Copy private key">{copiedKey==="private"?<Check size={17}/>:<Copy size={17}/>}<span>{copiedKey==="private"?"Copied":"Copy"}</span></button></div></div><div className="key-card public"><button className="mini-qr real-key-qr" aria-label="Open Hive identity public key" onClick={() => setScreen("public-key")}><QRCodeSVG value={walletKeys.publicKey} size={112} marginSize={2}/></button><b>PUBLIC KEY</b><small>Hive identity key. Safe to share, but it is not a Bitcoin address.</small><div className="inline-key-copy"><code>{walletKeys.publicKey}</code><button onClick={()=>copyKey("public")} aria-label="Copy public key">{copiedKey==="public"?<Check size={17}/>:<Copy size={17}/>}<span>{copiedKey==="public"?"Copied":"Copy"}</span></button></div></div></div>
        <p className="key-copy-hint">Your 12 recovery words—not these QR codes—restore your Bitcoin wallet. Get them later from “Back up my wallet” on My Cell.</p>
        {copyError && <p className="key-copy-status" role="status">{copyError}</p>}
        <div className="cell-card cell-key-hex"><svg viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0b0d0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><div><span>Your Cell</span><strong>D-313</strong><small>Your Hive identity</small></div></div>
        <Button className="unlock" onClick={() => {setWalletIntent("join");setScreen("home");}}>I’ve Saved My Keys</Button>
        <p className="session-note">Real Hive identity keys · Generated locally · Not uploaded or saved by Hive</p>
      </div>}

      {(screen === "private-key" || screen === "public-key") && walletKeys && <div className={`flow-screen key-detail-screen clean-key-screen ${screen === "private-key" ? "private" : "public"}`}>
        <button className="back" onClick={() => setScreen("keys")} aria-label="Back to your keys"><ArrowLeft/></button>
        <h2>{screen === "private-key" ? "Hive identity private key" : "Hive identity public key"}</h2>
        <div className="key-snapshot-hex">
          <svg className="key-snapshot-outline" viewBox="0 0 208 218" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#090c08" stroke="currentColor" strokeWidth="5"/></svg>
          <div className="key-snapshot-qr"><QRCodeSVG aria-label={`${screen === "private-key" ? "Private" : "Public"} key QR code`} value={screen === "private-key" ? walletKeys.privateKey : walletKeys.publicKey} size={190} marginSize={2}/></div>
        </div>
        <code className="key-snapshot-text">{screen === "private-key" ? walletKeys.privateKey : walletKeys.publicKey}</code>
      </div>}

      {screen === "enter" && <div className="flow-screen enter-screen">
        <button className="back" onClick={() => setScreen("welcome")} aria-label="Back"><ArrowLeft/></button>
        <div className="identity small"><HiveMark/><h1>THE HIVE</h1><p>PEOPLE <b>•</b> PAYMENTS <b>•</b> POSSIBILITIES</p></div>
        <h2>Enter The Hive</h2><p className="flow-copy">Paste or scan your private key to access your wallet.</p>
        <label className="key-field"><KeyRound size={19}/><Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your private key here…" aria-label="Private key"/><button aria-label="Scan private key"><QrCode size={20}/></button></label>
        <Button className="unlock" disabled={!key.trim()} onClick={() => setScreen("home")}>Unlock</Button>
        <p className="session-note"><Zap size={15}/> Your key is used only for this session and is never saved.</p>
      </div>}

      {screen === "send" && <div className="flow-screen hex-send-screen">
        <button className="back" onClick={()=>setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <div className="send-cell-top"><HexFrame/><span><small>MY CELL</small><b>D-313</b><strong>{formatDollars(balance)}</strong><small>{balance.toLocaleString()} sats</small></span></div>
        <h2>Send</h2>
        <p className="send-subtitle">Choose who. Choose how much.</p>
        <div className="send-honeycomb">
          <button className="send-method method-upper" onClick={()=>{setDestinationMode(destinationMode==="qr"?"cell":"qr");setRecipient("");setNotice("");}}><HexFrame/><span>{destinationMode==="qr"?<><Users/><small>Cell number</small></>:<><QrCode/><small>QR code</small></>}</span></button>
          <button className="send-method method-lower" onClick={()=>{setDestinationMode(destinationMode==="public"?"cell":"public");setRecipient("");setNotice("");}}><HexFrame/><span>{destinationMode==="public"?<><Users/><small>Cell number</small></>:<><KeyRound/><small>Public key</small></>}</span></button>
          <div className="send-destination"><HexFrame/><div className="send-hex-content">
            <label htmlFor="send-destination">{destinationMode==="cell"?"Cell number":destinationMode==="public"?"Public key":"Scan QR code"}</label>
            {destinationMode==="qr"?<><QrCode className="scan-design-icon"/><button className="scan-demo-action" onClick={()=>{setRecipient("A-101");setNotice("Demo scan selected A-101. Camera scanning comes later.");}}>Preview scan</button><small>{recipient || "Scan preview"}</small></>:destinationMode==="public"?<textarea id="send-destination" aria-label="Recipient public key" value={recipient} onChange={e=>{setRecipient(e.target.value);setNotice("");}} placeholder="Paste public key" rows={3}/>:<input id="send-destination" value={recipient} onChange={e=>{setRecipient(e.target.value);setNotice("");}} placeholder="A-101" autoCapitalize="characters"/>}
          </div></div>
          <div className="send-amount"><HexFrame/><div className="send-hex-content"><div className="send-amount-heading"><label htmlFor="send-amount">Amount</label><button className="send-unit-swap" onClick={swapSendUnit} aria-label={`Switch amount to ${sendUnit==="usd"?"sats":"dollars"}`}><ArrowUpDown size={12}/></button></div><div className="amount-input-line"><span>{sendUnit==="usd"?"$":""}</span><input id="send-amount" inputMode={sendUnit==="usd"?"decimal":"numeric"} placeholder={sendUnit==="usd"?"0.00":"0"} value={sendInput} onChange={e=>setSendValue(e.target.value)}/></div><small>{sendUnit==="usd"?`${Number(amount||0).toLocaleString()} sats`:formatDollars(Number(amount||0))}</small></div></div>
          {[{value:"0.02",label:"2¢",icon:"dot",name:"Honey dot"},{value:"0.10",label:"10¢",icon:"drop",name:"Honey drop"},{value:"0.25",label:"25¢",icon:"cell",name:"Honey cell"},{value:"1.00",label:"$1",icon:"four",name:"Four honey cells"},{value:"6.00",label:"$6",icon:"dipper",name:"Honey dipper"},{value:"24.00",label:"$24",icon:"comb",name:"Honeycomb chunk"}].map((preset,i)=><button key={preset.value} className={`send-preset preset-${i} ${Number(amount)===Math.round(Number(preset.value)*DEMO_SATS_PER_DOLLAR)?"chosen":""}`} onClick={()=>{setSendUnit("usd");setSendValue(preset.value,"usd");}} aria-label={`${preset.name}: set amount to ${preset.label}`} title={`${preset.name} · ${preset.label}`}><HexFrame/><span><HoneyAmountIcon kind={preset.icon as HoneyIconKind}/><small>{preset.label}</small></span></button>)}
        </div>
        {recipient && !validRecipient && <p className="send-validation">{destinationMode==="public"?"Paste the full public key for this demo.":"Use a Cell such as A-101, other than your own."}</p>}
        {sendInput && !validAmount && <p className="send-validation">Enter a positive amount{sendUnit==="usd"?" with up to two decimal places":" in whole sats"}.</p>}
        {validAmount&&sats>balance&&<p className="send-validation">Not enough spendable sats.</p>}
        <Button className="send-submit" disabled={!validAmount||!validRecipient||sats>balance} onClick={()=>recordPayment("sent")}><Send aria-hidden="true"/>Send {validAmount?formatDollars(sats):"sats"}</Button>
        {notice&&<p className="send-result" role="status">{notice}</p>}
        <p className="send-demo-note">Demo · $1 = 1,000 sats · QR scanning is a preview</p>
      </div>}

      {screen === "receive" && <div className="flow-screen receive-design"><button className="back" onClick={()=>setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button><div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div><p className="step">YOUR RECEIVING DETAILS</p><h2>Receive sats</h2><button className="lightning-entry" onClick={()=>setScreen("lightning")}>Receive with a connected wallet <ArrowUpRight size={16}/></button><p className="receive-cell-number">D-313</p><div className="receive-qr-hex"><HexFrame/><QrCode className="receive-qr-symbol" aria-label="Demo QR illustration"/></div><p className="receive-hint">Share your Cell or copy your public wallet info.</p><div className="receive-copy"><code>DEMO-PUBLIC-KEY-D313-NOT-A-REAL-WALLET</code><button onClick={()=>copyReceive("DEMO-PUBLIC-KEY-D313-NOT-A-REAL-WALLET")} aria-label="Copy public wallet info"><Copy size={18}/></button></div><button className="receive-copy-cell" onClick={()=>copyReceive("D-313")}>Copy Cell number <Copy size={13}/></button><button className="create-invoice-hex" onClick={startInvoice}><HexFrame/><span><Plus size={22}/><b>Create an<br/>invoice</b></span></button>{invoiceMessage&&<p className="invoice-status" role="status">{invoiceMessage}</p>}{demoInvoices.length>0&&<section className="invoice-history"><h3>Your demo invoices</h3>{demoInvoices.map(v=><button key={v.id} onClick={()=>{setInvoiceDraft(v);setInvoiceTo(v.to);setInvoiceMessage("");setScreen("invoice");}}><span>{v.note||"Payment request"}<small>{v.paid?"Paid · simulated":v.expires<Date.now()?"Expired":v.sent?`Addressed to ${v.to}`:"Ready to share"}</small></span><b>{formatDollars(v.sats)}</b></button>)}</section>}<p className="profile-demo-caption">Design preview · QR illustration and placeholder public info.<br/>No real Bitcoin or Lightning invoice.</p></div>}
      {screen === "invoice" && <div className="flow-screen invoice-screen"><button className="back" onClick={()=>{setScreen("receive");setInvoiceMessage("");}} aria-label="Back to receive"><ArrowLeft/></button><div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div><p className="step">REQUEST A SPECIFIC AMOUNT</p><h2>{invoiceDraft?"Your invoice":"Create an invoice"}</h2><p className="directory-copy">Receiving Cell · D-313</p>{!invoiceDraft?<div className="invoice-form"><label>Amount<div className="invoice-amount-field"><input aria-label="Invoice amount" inputMode={invoiceUnit==="usd"?"decimal":"numeric"} placeholder={invoiceUnit==="usd"?"0.00":"0"} value={invoiceValue} onChange={e=>setInvoiceValue(e.target.value)}/><select aria-label="Invoice currency" value={invoiceUnit} onChange={e=>{setInvoiceValue("");setInvoiceUnit(e.target.value as "usd"|"sats");}}><option value="usd">USD</option><option value="sats">sats</option></select></div></label><p className="invoice-conversion">{invoiceValid?`${invoiceSats.toLocaleString()} sats · ${formatDollars(invoiceSats)}`:"Set how much you want to receive."}</p><label>What is it for? <small>Optional</small><input value={invoiceNote} onChange={e=>setInvoiceNote(e.target.value)} maxLength={120} placeholder="Tickets, a lesson, dinner…"/></label><label>Expires after<select value={invoiceExpiry} onChange={e=>setInvoiceExpiry(e.target.value)}><option value="15">15 minutes</option><option value="60">1 hour</option><option value="1440">24 hours</option></select></label><Button disabled={!invoiceValid} onClick={createInvoice}>Create demo invoice</Button></div>:<div className="invoice-form invoice-created"><strong className="invoice-total">{formatDollars(invoiceDraft.sats)}</strong><small>{invoiceDraft.sats.toLocaleString()} sats</small><p>{invoiceDraft.note||"Payment request"}</p><div className="receive-qr-hex"><HexFrame/><QrCode className="receive-qr-symbol" aria-label="Demo invoice QR illustration"/></div><div className="receive-copy"><code>{invoiceText}</code><button onClick={()=>copyReceive(invoiceText)} aria-label="Copy demo invoice"><Copy size={18}/></button></div><p className="invoice-conversion">{invoiceDraft.paid?"Paid · simulated":invoiceDraft.expires<=Date.now()?"Expired":`Expires ${new Date(invoiceDraft.expires).toLocaleString()}`}</p><label>Send to a Cell<input placeholder="D-117" value={invoiceTo} onChange={e=>setInvoiceTo(e.target.value)} autoCapitalize="characters"/></label><Button disabled={invoiceDraft.paid||invoiceDraft.expires<=Date.now()} onClick={sendInvoice}>Send demo invoice</Button><button className="text-action" disabled={invoiceDraft.paid||invoiceDraft.expires<=Date.now()} onClick={()=>{const v={...invoiceDraft,paid:true};setBalance(old=>old+v.sats);setTransactions(old=>[{id:Date.now(),kind:"received",cell:`Invoice · ${v.to||"Demo payer"}`,amount:v.sats,time:new Date().toLocaleString()},...old]);setInvoiceDraft(v);setDemoInvoices(old=>old.map(x=>x.id===v.id?v:x));setInvoiceMessage("Simulated payment received. Balance and Activity updated.");}}>Simulate payment received</button><button className="text-action" onClick={startInvoice}>Create another invoice</button></div>}{invoiceMessage&&<p className="invoice-status" role="status">{invoiceMessage}</p>}<p className="profile-demo-caption">Demo only · $1 = 1,000 sats.<br/>Invoices are saved on this browser. Sending previews the workflow; it does not deliver to another user.</p></div>}

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

      {screen === "town" && <div className="flow-screen town-screen"><div className="profile-topbar"><button onClick={()=>setScreen("home")} aria-label="Back to wallet"><ArrowLeft/></button><span>THE HIVE</span><HexFrame/></div><h2>The town hexagon</h2><p className="directory-copy">A little space for everyone.</p><div className="town-welcome-sign"><span className="sign-fastener sign-fastener-left"/><HiveMark compact/><div><small>WELCOME TO</small><strong>THE HIVE</strong></div><span className="sign-fastener sign-fastener-right"/></div><div className="town-scene"><img src="/hive-town.png" alt="Cartoon hexagonal town plaza surrounded by Hive condos, with a stage, rows of seats and a ledger wall on the right"/><button className="town-wall-hit" onClick={()=>setTownLedger(!townLedger)} aria-label="Open the Hive ledger wall"/></div><div className="town-controls"><button onClick={()=>setScreen("directory")}><Search size={17}/>Find a Cell</button><button onClick={()=>setTownLedger(!townLedger)} aria-expanded={townLedger}><Clock3 size={17}/>Ledger wall</button></div>{townLedger&&<section className="town-ledger"><div className="profile-section-head"><h3>Hive ledger</h3><span>SIMULATED</span></div>{transactions.map(t=><div className="town-ledger-row" key={t.id}><span>{t.kind==="sent"?"D-313 → ":t.kind==="received"?"→ D-313 · ":"D-313 · "}{t.cell}<small>{t.time} · {t.kind}</small></span><b>{formatDollars(t.amount)}</b></div>)}</section>}<p className="profile-demo-caption">Demo town · all ledger entries are fictional.<br/>New demo payments and bucket transfers appear here and in Activity.</p></div>}
      {screen === "directory" && <div className="flow-screen hive-directory">
        <button className="back" onClick={()=>setScreen("town")} aria-label="Back to town square"><ArrowLeft/></button>
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <p className="profile-eyebrow">FIND YOUR PEOPLE</p><h2>The Hive</h2><p className="directory-copy">A Cell number. A familiar face.</p>
        <form className="cell-search" onSubmit={e=>{e.preventDefault();lookupCell();}}><Search size={19}/><input aria-label="Search directory by name, Cell number or tag" placeholder="Search names, Cells or tags" value={cellSearch} onChange={e=>setCellSearch(e.target.value)} autoCapitalize="characters"/><button type="submit" aria-label="Look up Cell"><ArrowUpRight/></button></form>
        {searchError&&<p className="directory-copy" role="status">{searchError}</p>}
        <div className="directory-list-heading"><p className="directory-section-label">DIRECTORY · {visibleMembers.length} CELLS</p><button onClick={()=>setScreen("my-profile")}>My profile <Pencil size={12}/></button></div>
        <div className="directory-members">{visibleMembers.map(m=><button className="directory-person" key={m.cell} onClick={()=>openMember(m.cell)}><DirectoryAvatar cell={m.cell} anonymous={m.name==="Anonymous Cell"}/><span className="directory-member-name"><b>{m.name}</b>{m.tag&&<small>{m.tag}</small>}</span><em>{m.cell}</em><ArrowUpRight/></button>)}</div>
        {!visibleMembers.length&&<p className="directory-copy">No Cells found. Try another name, Cell number or tag.</p>}
        <p className="profile-demo-caption">Demo directory · sample members.<br/>Anonymous Cells keep their number and hide their name and tag.</p>
      </div>}
      {screen === "my-profile" && <div className="flow-screen public-profile"><div className="profile-topbar"><button onClick={()=>setScreen("directory")} aria-label="Back to directory"><ArrowLeft/></button><span>MY PROFILE</span><Pencil size={18}/></div><div className="own-profile-avatar">{profileName.split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase()}</div><h2>{profileName}</h2><p className="profile-role">{profileCell} · {profileTag}</p><section className="profile-privacy"><h3>Directory privacy</h3><label><span><b>Appear as Anonymous Cell</b><small>Hide your name and tag. Your Cell number stays visible and can still receive tips.</small></span><input type="checkbox" role="switch" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/></label><p className="directory-section-label">HOW YOU APPEAR IN THE DIRECTORY</p><div className="privacy-preview"><span><b>{anonymous?"Anonymous Cell":profileName}</b>{!anonymous&&<small>{profileTag}</small>}</span><em>{profileCell}</em></div><p className="profile-demo-caption" role="status">{anonymous?"Your name and tag are hidden.":"Your name and tag are visible."} Saved to your signed-in Hive profile.</p></section><button className="own-directory-link" onClick={()=>{setCellSearch(profileCell);setScreen("directory");}}>View my directory listing <ArrowUpRight size={16}/></button></div>}
      {screen === "member" && <div className="flow-screen public-profile"><div className="profile-topbar"><button onClick={()=>setScreen("directory")} aria-label="Back to directory"><ArrowLeft/></button><span>PUBLIC PROFILE</span><Users size={18}/></div><div className="own-profile-avatar">{member.name==="Anonymous Cell"?<Users/>:member.name.split(" ").map(n=>n[0]).join("")}</div><h2>{member.name}</h2><p className="profile-role">{member.cell}{member.tag&&` · ${member.tag}`}</p><p className="profile-bio">{member.name==="Anonymous Cell"?"This member keeps their identity private.":"Part of the Hive."}</p><div className="profile-actions"><button className="profile-tip" onClick={()=>{openPayment("send");setRecipient(member.cell);}}><Send size={16}/>Send a tip</button></div><p className="profile-demo-caption">Demo member · simulated payments only.</p></div>}
      {screen === "profile" && <div className="flow-screen public-profile">
        <div className="profile-topbar"><button onClick={()=>setScreen("directory")} aria-label="Back to The Hive"><ArrowLeft size={20}/></button><span>PUBLIC PROFILE</span><button className={savedCell?"saved":""} onClick={()=>setSavedCell(!savedCell)} aria-label={savedCell?"Unsave Cell":"Save Cell"} aria-pressed={savedCell}><Bookmark size={20} fill={savedCell?"currentColor":"none"}/></button></div>
        <div className="profile-avatar" aria-label="Demo avatar for Marcus Reed"><svg viewBox="0 0 120 126" role="img"><defs><clipPath id="profile-portrait-clip"><path d="M60 3L112 33v60l-52 30L8 93V33Z"/></clipPath></defs><g clipPath="url(#profile-portrait-clip)"><rect width="120" height="126" fill="#334437"/><circle cx="83" cy="33" r="38" fill="#cbb077" opacity=".18"/><path d="M15 130v-17c0-28 19-45 45-45s45 17 45 45v17" fill="#151d19"/><path d="M50 61v17q10 13 20 0V61" fill="#b17a51"/><ellipse cx="60" cy="45" rx="23" ry="29" fill="#c9986f"/><path d="M37 42V27q5-20 26-18 23 2 22 28l-8-12q-14 9-33 4Z" fill="#24221e"/><path d="M46 53q14 19 28 0-2 24-14 24T46 53" fill="#382c25"/><path d="M53 55q7 5 14 0" stroke="#f2d6b7" strokeWidth="2" fill="none"/><circle cx="50" cy="43" r="2" fill="#28251f"/><circle cx="70" cy="43" r="2" fill="#28251f"/></g><path d="M60 3L112 33v60l-52 30L8 93V33Z" fill="none" stroke="#d7b674" strokeWidth="2"/></svg><span>D-117</span></div>
        <h2>Marcus Reed</h2><p className="profile-role">Comedian <span>·</span> Las Vegas</p><p className="profile-bio">Observational comedy.<br/>Questionable life decisions.</p>
        <div className="profile-socials"><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Open Instagram (demo platform link)"><Instagram size={18}/><span>Instagram</span></a><a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="Open YouTube (demo platform link)"><Youtube size={19}/><span>YouTube</span></a><button onClick={()=>setProfileNotice("Booking contact will appear here when the performer adds their email.")}><Mail size={18}/><span>Booking</span></button></div>
        <div className="profile-actions"><button onClick={()=>setSavedCell(!savedCell)}><Bookmark size={16} fill={savedCell?"currentColor":"none"}/>{savedCell?"Cell saved":"Save Cell"}</button><button className="profile-tip" onClick={()=>{openPayment("send");setRecipient("D-117");}}><Send size={16}/>Send a tip</button></div>
        {profileNotice&&<p className="profile-demo-caption" role="status">{profileNotice}</p>}
        <section className="profile-show"><div className="profile-section-head"><h3>Catch me next</h3><span>ONE UPCOMING SHOW</span></div><button className="flyer-preview" onClick={()=>setFlyerOpen(true)} aria-label="Enlarge upcoming show flyer"><ShowFlyer/><span className="flyer-enlarge">Tap to enlarge <ArrowUpRight size={13}/></span></button><div className="show-details"><p><CalendarDays size={15}/><span>Saturday, October 17 · 8 PM</span></p><p><MapPin size={15}/><span>The Honey Room · Las Vegas</span></p></div></section>
        <section className="profile-achievements"><div className="profile-section-head"><h3>A little recognition</h3></div><div className="profile-trophy-row"><span><Trophy/><small>First stage</small></span><span><HoneyAmountIcon kind="four"/><small>Hive regular</small></span><span><Zap/><small>First tip</small></span></div></section>
        <p className="profile-demo-caption">Design preview · fictional profile, flyer and achievements.<br/>Social buttons open platform homepages.</p>
        {flyerOpen&&<div className="flyer-modal" role="dialog" aria-modal="true" aria-label="Upcoming show flyer" onClick={()=>setFlyerOpen(false)} onKeyDown={e=>{if(e.key==="Escape")setFlyerOpen(false);}}><button autoFocus className="flyer-close" onClick={()=>setFlyerOpen(false)} aria-label="Close flyer"><X/></button><div onClick={e=>e.stopPropagation()}><ShowFlyer/></div></div>}
      </div>}

      {<div hidden={screen !== "lightning"} className="flow-screen"><button className="back" onClick={()=>setScreen("home")} aria-label="Back to demo wallet"><ArrowLeft/></button><LightningWallet/></div>}
      {screen === "home" && <div className="flow-screen home-screen">
        <div className="mini-brand"><HiveMark compact/><span>THE HIVE</span></div>
        <button className="cell-badge" aria-label="Open My Wallet and buckets" onClick={()=>setScreen("buckets")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><span>D-313</span><small>My Wallet</small></button>
        {walletConnected&&<button className="lightning-entry" onClick={()=>setScreen("hive-wallet")}><Zap size={18}/> Open your Bitcoin wallet <ArrowUpRight size={16}/></button>}
        <p className="profile-demo-caption">Demo wallet below · sample funds and Cells</p><p className="home-label">YOUR CELL · D-313</p><h2>{balance.toLocaleString()} sats</h2><p className="fiat">Spendable · {reserved.toLocaleString()} sats in buckets</p>
        <div className="home-actions"><button onClick={() => openPayment("send")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Send/><span>Send</span></button><button onClick={() => openPayment("receive")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><QrCode/><span>Receive</span></button><button onClick={()=>setScreen("town")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Users/><span>The Hive</span></button><button onClick={() => setScreen("activity")}><svg className="wallet-hex-frame" viewBox="6 6 196 206" fill="none" aria-hidden="true"><path d="M94 10Q104 4 114 10L192 55Q201 60 201 71V147Q201 158 192 163L114 208Q104 214 94 208L16 163Q7 158 7 147V71Q7 60 16 55Z" fill="#0c0f0b" stroke="#d7ad58" strokeWidth="1.8"/></svg><Clock3/><span>Activity</span></button></div>
        <p className="wallet-motto">Every bit counts.</p>
        <button className="restart" onClick={()=>setScreen("my-profile")}>My profile</button>
        {walletIntent&&<button className="restart" onClick={()=>{setBackupRequest(value=>value+1);setScreen("hive-wallet");}}>Back up my wallet</button>}
        <button className="restart" onClick={() => { setKey(""); setScreen("welcome"); }}>Return to startup</button>
        <p className="custody-note"><ShieldCheck size={15}/> Your keys. Your control. Always.</p>
      </div>}
    </section>
  </main>;
}
