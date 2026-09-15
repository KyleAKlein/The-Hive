"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Zap, Users, WalletCards, Hexagon, ArrowUpRight, ArrowDownLeft, MapPin, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Member = { name: string; cell: string; role: string; place: string; color: string; initials: string; live?: boolean; recent?: string };
const members: Member[] = [
  { name: "Maya Reyes", cell: "D-313", role: "Stand-up comic", place: "The Lantern Room", color: "#f4b941", initials: "MR", live: true, recent: "Crowd work set · Tonight" },
  { name: "Theo Brooks", cell: "A-108", role: "Piano & vocals", place: "Juniper House", color: "#ef805f", initials: "TB", live: true, recent: "Late set · Tonight" },
  { name: "Nina Park", cell: "F-224", role: "Illustrator", place: "Arts District", color: "#73b9a8", initials: "NP", recent: "Live sketching · Friday" },
  { name: "Marcus Cole", cell: "B-019", role: "Server", place: "Little Sparrow", color: "#8f87d8", initials: "MC", recent: "Dinner service · Yesterday" },
  { name: "June Lee", cell: "E-442", role: "DJ", place: "Afterglow", color: "#da6e9b", initials: "JL", recent: "Vinyl night · Saturday" },
  { name: "Sol Bennett", cell: "C-071", role: "Busker", place: "Fremont East", color: "#e7a649", initials: "SB", live: true, recent: "Corner session · Now" },
];
const activity = [
  { type: "sent", name: "Maya Reyes", detail: "Loved the closer", sats: -2500, time: "8 min" },
  { type: "received", name: "Theo Brooks", detail: "Backed your open mic pick", sats: 1000, time: "Yesterday" },
  { type: "sent", name: "Sol Bennett", detail: "Fremont session", sats: -500, time: "Sat" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [amount, setAmount] = useState(1000);
  const [note, setNote] = useState("");
  const [balance, setBalance] = useState(48250);
  const [sent, setSent] = useState(false);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return members.filter((m) => !q || `${m.name} ${m.cell} ${m.role} ${m.place}`.toLowerCase().includes(q)); }, [query]);
  function openTip(member: Member) { setSelected(member); setAmount(1000); setNote(""); setSent(false); }
  function sendTip() { if (!selected || amount <= 0 || amount > balance) return; setBalance((b) => b - amount); setSent(true); }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({ name: "search_hive", title: "Search The Hive", description: "Search the public Hive directory by member name, cell ID, craft, or place and update the visible results.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input: unknown) { const value = (input as { query?: unknown })?.query; if (typeof value !== "string") throw new Error("query must be a string"); setQuery(value); return { query: value, matches: members.filter(m => `${m.name} ${m.cell} ${m.role} ${m.place}`.toLowerCase().includes(value.toLowerCase())).map(m => ({ name: m.name, cell: m.cell })) }; } }, { signal: lifecycle.signal });
      await context.registerTool({ name: "stage_tip", title: "Stage a demo tip", description: "Open the visible tip flow for a public Hive member. This stages a simulated payment but does not send real bitcoin.", inputSchema: { type: "object", properties: { cell: { type: "string" }, sats: { type: "integer", minimum: 1 } }, required: ["cell", "sats"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const { cell, sats } = input as { cell?: unknown; sats?: unknown }; const member = members.find(m => m.cell.toLowerCase() === String(cell).toLowerCase()); if (!member) throw new Error("Hive cell not found"); if (!Number.isInteger(sats) || Number(sats) < 1 || Number(sats) > balance) throw new Error("invalid tip amount"); openTip(member); setAmount(Number(sats)); return { status: "staged", recipient: member.name, cell: member.cell, sats }; } }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [balance]);

  return <main className="min-h-screen">
    <header className="topbar"><div className="brand"><span className="brand-mark"><Hexagon size={23} fill="currentColor" /></span><span>The Hive</span></div><div className="top-actions"><span className="network"><i /> Lightning ready</span><button className="profile-chip"><span>KK</span><b>D-247</b></button></div></header>
    <Tabs defaultValue="hive" className="app-shell">
      <aside className="sidebar"><TabsList className="nav-list"><TabsTrigger value="hive"><Users size={20}/><span>The Hive</span></TabsTrigger><TabsTrigger value="wallet"><WalletCards size={20}/><span>Wallet</span></TabsTrigger><TabsTrigger value="objects"><Trophy size={20}/><span>Objects</span></TabsTrigger></TabsList><div className="wallet-mini"><span>Available</span><strong>{balance.toLocaleString()} <small>sats</small></strong><p>≈ ${(balance * 0.00068).toFixed(2)} USD</p></div><div className="self-custody"><Zap size={16}/><p><b>Your keys. Your bitcoin.</b><br/>The Hive never holds your funds.</p></div></aside>
      <section className="content">
        <TabsContent value="hive" className="view"><div className="view-head"><div><p className="eyebrow">Public directory</p><h1>Find someone in The Hive</h1><p>Search by name, cell, craft, or place. Send appreciation whenever it strikes.</p></div><Button className="scan-button" onClick={() => openTip(members[0])}><Zap size={18} fill="currentColor"/> Quick tip</Button></div><label className="search-box"><Search size={21}/><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Maya, D-313, comedy…" aria-label="Search the Hive"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={17}/></button>}</label><div className="section-row"><h2>{query ? `${filtered.length} matches` : "In your orbit"}</h2><span>{members.filter(m => m.live).length} live now</span></div><div className="member-grid">{filtered.map((member) => <article className="member-card" key={member.cell}><div className="avatar" style={{background: member.color}}>{member.initials}{member.live && <i />}</div><div className="member-main"><div className="member-title"><h3>{member.name}</h3><span>{member.cell}</span></div><p>{member.role}</p><small><MapPin size={13}/>{member.place}</small></div><div className="member-foot"><span>{member.recent}</span><Button variant="outline" onClick={() => openTip(member)}>Tip <Zap size={15} fill="currentColor"/></Button></div></article>)}</div>{filtered.length === 0 && <div className="empty"><Search size={30}/><h3>No cells found</h3><p>Try a name, craft, venue, or a cell like D-313.</p></div>}</TabsContent>
        <TabsContent value="wallet" className="view"><div className="view-head"><div><p className="eyebrow">Your wallet</p><h1>{balance.toLocaleString()} sats</h1><p>Payments settle directly between Lightning wallets.</p></div><div className="wallet-actions"><Button><ArrowDownLeft size={17}/> Receive</Button><Button variant="outline" onClick={() => openTip(members[0])}><ArrowUpRight size={17}/> Send</Button></div></div><div className="balance-card"><div><span>Spendable balance</span><strong>{balance.toLocaleString()}</strong><small>satoshis</small></div><div className="bolt-orbit"><Zap size={40} fill="currentColor"/></div></div><div className="section-row"><h2>Recent activity</h2></div><div className="activity-list">{activity.map((item, i) => <div className="activity-item" key={i}><span className={item.type}>{item.type === "sent" ? <ArrowUpRight/> : <ArrowDownLeft/>}</span><div><b>{item.name}</b><p>{item.detail}</p></div><div className="amount"><b className={item.sats > 0 ? "positive" : ""}>{item.sats > 0 ? "+" : ""}{item.sats.toLocaleString()} sats</b><small>{item.time}</small></div></div>)}</div></TabsContent>
        <TabsContent value="objects" className="view"><div className="view-head"><div><p className="eyebrow">Your shelf</p><h1>Objects earned in motion</h1><p>Each piece marks something you did—not a balance you bought.</p></div></div><div className="object-hero"><div className="object-art"><div className="coin"><Zap fill="currentColor"/></div><span className="ring r1"/><span className="ring r2"/></div><div><span className="rare">Rare object · 1 of 842</span><h2>First Spark</h2><p>You sent your first Lightning tip into The Hive.</p><small>Earned September 14, 2026</small></div></div><div className="section-row"><h2>Your collection</h2><span>3 of 12 discovered</span></div><div className="object-grid"><div className="object-card amber"><Sparkles/><b>First Spark</b><span>First tip sent</span></div><div className="object-card coral"><Users/><b>Swarm Signal</b><span>5 people supported</span></div><div className="object-card teal"><Zap/><b>Current Keeper</b><span>10,000 sats received</span></div><div className="object-card locked"><Hexagon/><b>Undiscovered</b><span>Keep moving</span></div></div></TabsContent>
      </section>
    </Tabs>
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="tip-dialog">{!sent ? <><DialogHeader><DialogTitle>Send a spark</DialogTitle><DialogDescription>Your tip goes directly to {selected?.name}’s Lightning wallet.</DialogDescription></DialogHeader><div className="tip-person"><div className="avatar" style={{background:selected?.color}}>{selected?.initials}</div><div><b>{selected?.name}</b><span>{selected?.cell} · {selected?.role}</span></div></div><div className="amount-picks">{[500,1000,2500,5000].map(v => <button key={v} className={amount===v?"active":""} onClick={()=>setAmount(v)}>{v.toLocaleString()}<small>sats</small></button>)}</div><Input className="note-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note (optional)"/><div className="tip-summary"><span>From your wallet</span><b>{amount.toLocaleString()} sats</b></div><Button className="send-button" disabled={amount > balance} onClick={sendTip}><Zap fill="currentColor"/> Send {amount.toLocaleString()} sats</Button></> : <div className="success-state"><div className="success-bolt"><Zap fill="currentColor"/></div><p className="eyebrow">Payment sent</p><h2>{amount.toLocaleString()} sats reached {selected?.name}</h2><p>{note || "A little energy, sent instantly."}</p><Button onClick={()=>setSelected(null)}>Back to The Hive</Button></div>}</DialogContent></Dialog>
  </main>;
}
