import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import type { BreezSdk, Network } from '@breeztech/breez-sdk-spark/ssr';

export const HIVE_WALLET_NETWORK = 'regtest' as const satisfies Network;
export const HIVE_LIGHTNING_ENABLED = false;

export const normalizeRecovery = (value: string) => value.normalize('NFKD').trim().toLowerCase().replace(/\s+/g, ' ');
export function createRecovery() { return generateMnemonic(wordlist, 128); }
export function checkRecovery(value: string) {
 const normalized = normalizeRecovery(value);
 if (!validateMnemonic(normalized, wordlist)) throw new Error('Enter valid Hive recovery words in their original order.');
 return normalized;
}
export function backupMatches(original: string, confirmation: string) {
 return checkRecovery(original) === checkRecovery(confirmation);
}
const toHex = (value: Uint8Array) => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
export function createHiveKeyPair(recovery: string) {
 const seed = mnemonicToSeedSync(checkRecovery(recovery));
 try {
  const { secretKey, publicKey } = secp256k1.keygen(seed.subarray(0, 48));
  return { privateKey: toHex(secretKey), publicKey: toHex(publicKey) };
 } finally {
  seed.fill(0);
 }
}
export async function recoveryFingerprint(value: string) {
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checkRecovery(value)));
 return Array.from(new Uint8Array(digest).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}
let initialization: Promise<void> | undefined;
export async function walletStorageDir(recovery: string) {
 const fingerprint = await recoveryFingerprint(recovery);
 return `hive-${HIVE_WALLET_NETWORK}-${fingerprint}`;
}
export async function connectHiveWallet(recovery: string): Promise<BreezSdk> {
 const mnemonic = checkRecovery(recovery);
 const module = await import('@breeztech/breez-sdk-spark/ssr');
 initialization ??= module.default().catch(error => {initialization=undefined;throw error;});
 await initialization;
 const config = module.defaultConfig(HIVE_WALLET_NETWORK);
 return module.connect({
  config,
  seed:{type:'mnemonic',mnemonic,passphrase:undefined},
  storageDir:await walletStorageDir(mnemonic),
 });
}
