import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 createRecovery,
 checkRecovery,
 normalizeRecovery,
 backupMatches,
 recoveryFingerprint,
 walletStorageDir,
 HIVE_LIGHTNING_ENABLED,
 HIVE_WALLET_NETWORK,
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
test('wallet storage fingerprints are deterministic and separate wallets',async()=>{
 assert.equal(await recoveryFingerprint(known),await recoveryFingerprint(known.toUpperCase()));
 assert.notEqual(await recoveryFingerprint(known),await recoveryFingerprint(createRecovery()));
});
test('embedded wallet is locked to keyless regtest with Lightning disabled',async()=>{
 assert.equal(HIVE_WALLET_NETWORK,'regtest');
 assert.equal(HIVE_LIGHTNING_ENABLED,false);
 assert.match(await walletStorageDir(known),/^hive-regtest-[a-f0-9]{24}$/);
});
test('wallet WebAssembly validates locally without a credential or funding',async()=>{
 const bytes=readFileSync('node_modules/@breeztech/breez-sdk-spark/web/breez_sdk_spark_wasm_bg.wasm');
 assert.equal(WebAssembly.validate(bytes),true);
 await WebAssembly.compile(bytes);
});
