import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { satsToMsats, validateConnection, reviewInvoice, verifyPreimage } from '../lib/lightning.ts';
const fixture = readFileSync('node_modules/light-bolt11-decoder/README.md','utf8').match(/'(lnbc20u[^']+)'/)[1];
test('amounts convert exactly and reject unsafe or fractional sats',()=>{
 assert.equal(satsToMsats('21'),21000);
 for(const value of ['0','-1','1.2','1e3','9007199254740992','100000001',''])assert.throws(()=>satsToMsats(value));
});
test('connection accepts only app credentials with secure relays',()=>{
 const uri=`nostr+walletconnect://${'a'.repeat(64)}?secret=${'b'.repeat(64)}&relay=wss%3A%2F%2Frelay.example.com`;
 assert.equal(validateConnection(uri),uri);
 assert.throws(()=>validateConnection(uri.replace('wss','ws')));
 assert.throws(()=>validateConnection('my recovery words'));
 assert.throws(()=>validateConnection(uri.replace('secret=','invalid=')));
});
test('invoice review verifies amount, network, expiry and checksum',()=>{
 const now=Date.now;
 try{
 Date.now=()=>0;
 const result=reviewInvoice(fixture,'mainnet');
 assert.equal(result.msats,2000000);
 assert.match(result.hash,/^[a-f0-9]{64}$/);
 assert.throws(()=>reviewInvoice(fixture,'testnet'));
 assert.throws(()=>reviewInvoice(fixture.slice(0,-1)+'q','mainnet'));
 Date.now=()=>9999999999999;
 assert.throws(()=>reviewInvoice(fixture,'mainnet'));
 assert.equal(reviewInvoice(fixture,'mainnet',true).msats,2000000);
 }finally{Date.now=now;}
});
test('payment success needs a preimage matching the invoice hash',async()=>{
 const preimage='ab'.repeat(32);
 const hash=createHash('sha256').update(Buffer.from(preimage,'hex')).digest('hex');
 assert.equal(await verifyPreimage(preimage,hash),true);
 assert.equal(await verifyPreimage('cd'.repeat(32),hash),false);
 assert.equal(await verifyPreimage('not-a-proof',hash),false);
});
