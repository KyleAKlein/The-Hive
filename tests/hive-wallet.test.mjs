import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 createRecovery,
 createHiveKeyPair,
 checkRecovery,
 normalizeRecovery,
 backupMatches,
 recoveryFingerprint,
 walletStorageDir,
 HIVE_LIGHTNING_ENABLED,
 HIVE_WALLET_NETWORK,
 usdToSats,
} from '../lib/hive-wallet.ts';
const known='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
test('new recovery keys have 12 valid words and are unique',()=>{
 const first=createRecovery(),second=createRecovery();
 assert.equal(first.split(' ').length,12);
 assert.equal(checkRecovery(first),first);
 assert.notEqual(first,second);
});
test('recovery normalizes case and whitespace and rejects invalid checksums',()=>{
 assert.equal(checkRecovery('  '+known.toUpperCase().replaceAll(' ','\n ')+' '),known);
 assert.equal(normalizeRecovery('  ONE  TWO '),'one two');
 assert.throws(()=>checkRecovery(known.replace('about','abandon')));
 assert.throws(()=>checkRecovery('DEMO-PRIVATE-KEY-D313-NOT-A-REAL-WALLET'));
});
test('backup verification requires the same key, not just any valid key',()=>{
 assert.equal(backupMatches(known,known.toUpperCase()),true);
 assert.equal(backupMatches(known,createRecovery()),false);
});
test('recovery deterministically creates a valid compressed secp256k1 key pair',()=>{
 const first=createHiveKeyPair(known),second=createHiveKeyPair(known.toUpperCase());
 assert.deepEqual(first,second);
 assert.match(first.privateKey,/^[a-f0-9]{64}$/);
 assert.match(first.publicKey,/^0[23][a-f0-9]{64}$/);
 assert.notDeepEqual(first,createHiveKeyPair(createRecovery()));
});
test('wallet storage fingerprints are deterministic and separate wallets',async()=>{
 assert.equal(await recoveryFingerprint(known),await recoveryFingerprint(known.toUpperCase()));
 assert.notEqual(await recoveryFingerprint(known),await recoveryFingerprint(createRecovery()));
});
test('embedded wallet is configured for Breez Spark mainnet with Lightning enabled',async()=>{
 assert.equal(HIVE_WALLET_NETWORK,'mainnet');
 assert.equal(HIVE_LIGHTNING_ENABLED,true);
 assert.match(await walletStorageDir(known),/^hive-mainnet-[a-f0-9]{24}$/);
});
test('live dollar quotes convert to a whole sat amount',()=>{
 assert.equal(usdToSats(5,100000),5000);
 assert.equal(usdToSats(5,66666.67),7500);
 assert.throws(()=>usdToSats(5,0));
 assert.throws(()=>usdToSats(Number.NaN,100000));
});
test('wallet WebAssembly validates locally without a credential or funding',async()=>{
 const bytes=readFileSync('node_modules/@breeztech/breez-sdk-spark/web/breez_sdk_spark_wasm_bg.wasm');
 assert.equal(WebAssembly.validate(bytes),true);
 await WebAssembly.compile(bytes);
});
