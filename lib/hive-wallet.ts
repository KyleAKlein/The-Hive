import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import type { BreezSdk, Network } from '@breeztech/breez-sdk-spark/ssr';

export const HIVE_WALLET_NETWORK = 'mainnet' as const satisfies Network;
export const HIVE_LIGHTNING_ENABLED = true;

export const normalizeRecovery = (value: string) => value.normalize('NFKD').trim().toLowerCase().replace(/\s+/g, ' ');
export function usdToSats(usdAmount: number, usdPerBitcoin: number) {
 if (!Number.isFinite(usdAmount) || usdAmount <= 0 || !Number.isFinite(usdPerBitcoin) || usdPerBitcoin <= 0) {
  throw new Error('A positive dollar amount and Bitcoin price are required.');
 }
 return Math.max(1, Math.round((usdAmount / usdPerBitcoin) * 100_000_000));
}
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
// Versioned wallet backup: losslessly encode the BIP39 word indices, including
// their checksum. This is wallet recovery material, not an identity signing key.
const PRIVATE_KEY_PREFIX = 'hive-wallet-v1:';
export function createWalletPrivateKey(recovery: string) {
 return PRIVATE_KEY_PREFIX + checkRecovery(recovery).split(' ').map(word => wordlist.indexOf(word).toString(16).padStart(3, '0')).join('');
}
export function restoreWalletPrivateKey(value: string) {
 const normalized = value.trim().toLowerCase();
 if (!normalized.startsWith(PRIVATE_KEY_PREFIX)) return checkRecovery(value);
 const payload = normalized.slice(PRIVATE_KEY_PREFIX.length);
 if (!/^(?:[0-7][a-f0-9]{2})+$/.test(payload) || ![36,45,54,63,72].includes(payload.length)) {
  throw new Error('Invalid Hive wallet private key.');
 }
 return checkRecovery(payload.match(/.{3}/g)!.map(index => wordlist[parseInt(index,16)]).join(' '));
}
export function createWalletAccessKeys(recovery: string) {
 return { privateKey: createWalletPrivateKey(recovery), publicKey: createHiveKeyPair(recovery).publicKey };
}
export async function recoveryFingerprint(value: string) {
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checkRecovery(value)));
 return Array.from(new Uint8Array(digest).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}
let initialization: Promise<void> | undefined;
async function loadBreezApiKey() {
 const response = await fetch('/api/breez-config', {
  cache: 'no-store',
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
 });
 const body = await response.json().catch(() => ({})) as {apiKey?: unknown;error?: unknown};
 if (!response.ok || typeof body.apiKey !== 'string' || !body.apiKey.trim()) {
  throw new Error(typeof body.error === 'string' ? body.error : 'The Breez wallet connection is unavailable.');
 }
 return body.apiKey.trim();
}
export async function walletStorageDir(recovery: string) {
 const fingerprint = await recoveryFingerprint(recovery);
 return `hive-${HIVE_WALLET_NETWORK}-${fingerprint}`;
}
export async function connectHiveWallet(recovery: string): Promise<BreezSdk> {
 const mnemonic = checkRecovery(recovery);
 const apiKey = await loadBreezApiKey();
 const module = await import('@breeztech/breez-sdk-spark/ssr');
 initialization ??= module.default().catch(error => {initialization=undefined;throw error;});
 await initialization;
 const config = module.defaultConfig(HIVE_WALLET_NETWORK);
 config.apiKey = apiKey;
 return module.connect({
  config,
  seed:{type:'mnemonic',mnemonic,passphrase:undefined},
  storageDir:await walletStorageDir(mnemonic),
 });
}
