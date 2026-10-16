"use client";
import { useEffect, useRef, useState } from 'react';
import type { NWCClient } from '@getalby/sdk/nwc';
import { QRCodeSVG } from 'qrcode.react';
import { reviewInvoice, satsToMsats, validateConnection, verifyPreimage } from '@/lib/lightning';

type Client = NWCClient;
type Info = Awaited<ReturnType<Client['getInfo']>>;
type Tx = Awaited<ReturnType<Client['makeInvoice']>>;
export default function LightningWallet() {
 const client = useRef<Client | null>(null);
 const lock = useRef(false);
 const generation = useRef(0);
 const [connection,setConnection] = useState('');
 const [info,setInfo] = useState<Info | null>(null);
 const [balance,setBalance] = useState<number | null>(null);
 const [busy,setBusy] = useState(false);
 const [message,setMessage] = useState('Connect a wallet when ready. No Bitcoin is needed to explore the demo.');
 const [amount,setAmount] = useState('');
 const [note,setNote] = useState('');
 const [expiry,setExpiry] = useState('3600');
 const [request,setRequest] = useState<Tx | null>(null);
 const [input,setInput] = useState('');
 const [review,setReview] = useState<ReturnType<typeof reviewInvoice> | null>(null);
 const [history,setHistory] = useState<Tx[]>([]);
 const [uncertain,setUncertain] = useState(false);
 const [receipt,setReceipt] = useState('');
 useEffect(()=>()=>{generation.current++; client.current?.close();},[]);
 async function run(action:()=>Promise<void>) {
   if(lock.current)return;
   lock.current=true;setBusy(true);
   try {await action();} catch {setMessage('The wallet request could not be completed. Check wallet permissions, connection, and network. No demo balance was changed.');}
   finally {lock.current=false;setBusy(false);}
 }
 async function refresh(c:Client, methods:string[]) {
   const results=await Promise.allSettled([methods.includes('get_balance')?c.getBalance():Promise.resolve(null),methods.includes('list_transactions')?c.listTransactions({limit:20}):Promise.resolve(null)]);
   if(client.current!==c)return;
   const b=results[0]; if(b.status==='fulfilled'&&b.value)setBalance(b.value.balance);
   const h=results[1]; if(h.status==='fulfilled'&&h.value)setHistory(h.value.transactions);
 }
 function disconnect(){generation.current++;client.current?.close();client.current=null;setInfo(null);setBalance(null);setHistory([]);setRequest(null);setReview(null);setInput('');setReceipt('');setUncertain(false);setConnection('');setMessage('Disconnected. Revoke the connection in your wallet to remove its permission permanently.');}
 const can=(method:string)=>!!info?.methods.includes(method as Info['methods'][number]);
 const field=(label:string,element:React.ReactNode)=><label>{label}{element}</label>;
 return <section className="lightning-wallet" aria-label="Connected Lightning wallet">
 <p className="step">LIGHTNING CONNECTION</p><h2>Your connected wallet</h2>
 <p className="lightning-muted">Your wallet holds the funds. Hive’s sample balance, Cells and buckets are separate from this connection.</p>
 {!info?<><p>Create a Nostr Wallet Connect (NWC) app connection in a compatible wallet. Set a small spending limit. Wallet custody depends on the wallet you choose.</p>
 {field('Wallet connection',<input type="password" autoComplete="off" spellCheck={false} value={connection} onChange={e=>setConnection(e.target.value)} placeholder="nostr+walletconnect://…" />)}
 <p className="lightning-muted">Use an app connection, never a seed phrase or recovery key. Kept in memory for this page only; reconnect after reloading.</p>
 <button disabled={busy||!connection.trim()} onClick={()=>run(async()=>{let uri:string;try{uri=validateConnection(connection);}catch{setMessage('Enter a valid NWC connection with a secure relay and app secret.');return;}const {NWCClient}=await import('@getalby/sdk/nwc');const c=new NWCClient({nostrWalletConnectUrl:uri});client.current=c;try{const details=await c.getInfo();setInfo(details);setConnection('');try{const pending=localStorage.getItem('hive-pending-'+c.publicKey);if(pending){setInput(pending);setReview(reviewInvoice(pending,details.network,true));setUncertain(true);}}catch{}setMessage('Wallet connected. Check the network before sending funds.');await refresh(c,details.methods);}catch{c.close();client.current=null;throw new Error('connect');}})}>Connect wallet</button>
 <details><summary>Not ready to connect?</summary><p>The existing Hive demo still works without money. A compatible test wallet can exercise this connection; Hive displays the network reported by that wallet. No funding address exists until a wallet creates an invoice.</p></details></>:<>
 <div className="lightning-summary"><b>{info.alias||'Lightning wallet'}</b><span>{info.network === 'mainnet'?'Bitcoin mainnet · real funds':`${info.network} · test network`}</span><strong>{balance===null?'Balance unavailable':`${(balance/1000).toLocaleString()} sats`}</strong><small>Reported by your connected wallet</small></div>
 <div className="lightning-buttons"><button disabled={busy} onClick={()=>run(async()=>{await refresh(client.current!,info.methods);setMessage('Requested the latest wallet balance and activity.');})}>Refresh wallet</button><button disabled={busy} onClick={disconnect}>Disconnect</button></div>
 <h3>Receive · Create an invoice</h3>
 {!can('make_invoice')?<p>Your wallet connection has no invoice creation permission.</p>:<>
 {field('Amount in sats',<input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="1000"/>)}
 {field('Note (optional)',<input value={note} maxLength={120} onChange={e=>setNote(e.target.value)}/>)}
 {field('Expires after',<select value={expiry} onChange={e=>setExpiry(e.target.value)}><option value="900">15 minutes</option><option value="3600">1 hour</option><option value="86400">24 hours</option></select>)}
 <button disabled={busy} onClick={()=>run(async()=>{let msats:number;try{msats=satsToMsats(amount);}catch{setMessage('Enter a whole number from 1 to 100,000,000 sats.');return;}const v=await client.current!.makeInvoice({amount:msats,description:note.trim(),expiry:Number(expiry)});if(!v.invoice)throw new Error('missing invoice');const checked=reviewInvoice(v.invoice,info.network);if(checked.msats!==msats)throw new Error('invoice amount mismatch');setRequest(v);setMessage('Wallet invoice created. Share the QR or invoice; payment is not yet confirmed.');})}>Create wallet invoice</button></>}
 {request&&<div className="lightning-invoice"><div className="lightning-qr"><QRCodeSVG value={request.invoice.toUpperCase()} size={228} level="M" marginSize={4}/></div><b>{(request.amount/1000).toLocaleString()} sats</b><p>{request.state==='settled'||request.settled_at?'Paid · wallet confirmed':request.expires_at*1000<Date.now()?'Expired':'Awaiting payment'}</p><textarea aria-label="Lightning invoice" readOnly value={request.invoice}/><div className="lightning-buttons"><button disabled={busy} onClick={()=>run(async()=>{await navigator.clipboard.writeText(request.invoice);setMessage('Invoice copied.');})}>Copy invoice</button><button disabled={busy} onClick={()=>run(async()=>{if(navigator.share)await navigator.share({title:'Hive payment request',text:request.invoice});else {await navigator.clipboard.writeText(request.invoice);setMessage('Invoice copied for sharing.');}})}>Share</button><button disabled={busy||!can('lookup_invoice')} onClick={()=>run(async()=>{const v=await client.current!.lookupInvoice({invoice:request.invoice});setRequest(v);setMessage(v.state==='settled'||v.settled_at?'Payment confirmed by wallet.':'Wallet has not confirmed payment.');await refresh(client.current!,info.methods);})}>Check payment</button></div><p className="lightning-muted">This invoice belongs to the connected wallet. Demo Cell D-313 is not registered to it. Sending requests to another Cell is not connected yet.</p></div>}
 <h3>Send · Pay an invoice</h3>
 {field('Lightning invoice',<textarea spellCheck={false} value={input} onChange={e=>{setInput(e.target.value);setReview(null);setReceipt('');}} placeholder="Paste a BOLT11 invoice" disabled={busy||uncertain}/>)}
 <button disabled={busy||uncertain||!can('pay_invoice')} onClick={()=>{try{setReview(reviewInvoice(input,info.network));setMessage('Review the amount and note before confirming. Network fees may apply.');}catch(e){setReview(null);setMessage(e instanceof Error?e.message:'Invalid invoice.');}}}>Review payment</button>
 {review&&<div className="lightning-review"><b>{(review.msats/1000).toLocaleString()} sats + wallet network fees</b><p>{review.description}</p><small>{info.network} · Expires {new Date(review.expires*1000).toLocaleString()}</small><button disabled={busy||uncertain||!!receipt} onClick={()=>run(async()=>{const c=client.current!;const checked=reviewInvoice(review.invoice,info.network);setMessage('Payment submitted. Waiting for wallet confirmation.');setUncertain(true);try{localStorage.setItem('hive-pending-'+c.publicKey,checked.invoice);}catch{setMessage('Cannot save payment recovery information in this browser. Payment was not submitted.');setUncertain(false);return;}try{const result=await c.payInvoice({invoice:checked.invoice});if(!await verifyPreimage(result.preimage,checked.hash))throw new Error('unverified');setReceipt(checked.hash);localStorage.removeItem('hive-pending-'+c.publicKey);setUncertain(false);setMessage(`Payment confirmed. Fee: ${result.fees_paid/1000} sats.`);await refresh(c,info.methods);}catch{setMessage('Payment outcome is unknown. Check your wallet or use Check outgoing payment before trying again.');}})}>Confirm payment</button></div>}
 {uncertain&&<button disabled={busy||!can('lookup_invoice')} onClick={()=>run(async()=>{if(!review)return;const tx=await client.current!.lookupInvoice({invoice:review.invoice});if(tx.type==='outgoing'&&(tx.state==='settled'||tx.settled_at)){setReceipt(review.hash);localStorage.removeItem('hive-pending-'+client.current!.publicKey);setUncertain(false);setMessage('Outgoing payment confirmed by wallet.');}else if(tx.type==='outgoing'&&tx.state==='failed'){localStorage.removeItem('hive-pending-'+client.current!.publicKey);setUncertain(false);setReview(null);setMessage('Wallet reports payment failed. Review again before retrying.');}else setMessage('No final outgoing payment result yet. Check the wallet before retrying.');await refresh(client.current!,info.methods);})}>Check outgoing payment</button>}
 {receipt&&<p className="lightning-muted">Payment receipt · {receipt}</p>}
 <h3>Wallet activity</h3>{!can('list_transactions')?<p>Activity permission is unavailable.</p>:history.length?history.map(tx=><div className="lightning-transaction" key={`${tx.payment_hash}-${tx.type}`}><span>{tx.type==='incoming'?'Received':'Sent'} · {tx.state}<small>{tx.description||'Lightning payment'}</small></span><b>{(tx.amount/1000).toLocaleString()} sats</b></div>):<p>No wallet activity loaded.</p>}
 </>}
 <p className="lightning-status" role="status" aria-live="polite">{busy?'Working with wallet… ':''}{message}</p>
 </section>;
}
