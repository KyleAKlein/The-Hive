import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { BreezSdk, Network } from '@breeztech/breez-sdk-spark/ssr';

export const normalizeRecovery = (value: string) => value.normalize('NFKD').trim().toLowerCase().replace(/\s+/g, ' ');
export function createRecovery() { return generateMnemonic(wordlist, 256); }
export function checkRecovery(value: string) {
 const normalized = normalizeRecovery(value);
 if (!validateMnemonic(normalized, wordlist)) throw new Error('Enter valid Hive recovery words in their original order.');
 return normalized;
}
export function backupMatches(original: string, confirmation: string) {
 return checkRecovery(original) === checkRecovery(confirmation);
}
export async function recoveryFingerprint(value: string) {
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checkRecovery(value)));
 return Array.from(new Uint8Array(digest).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}
let initialization: Promise<void> | undefined;
export async function connectHiveWallet(recovery: string, apiKey: string, network: Network): Promise<BreezSdk> {
 if (!apiKey.trim()) throw new Error('Wallet service configuration is required.');
 const mnemonic = checkRecovery(recovery);
 const module = await import('@breeztech/breez-sdk-spark/ssr');
 initialization ??= module.default().catch(error => {initialization=undefined;throw error;});
 await initialization;
 const config = module.defaultConfig(network);
 config.apiKey = apiKey.trim();
 const fingerprint = await recoveryFingerprint(mnemonic);
 return module.connect({config, seed:{type:'mnemonic',mnemonic},storageDir:`hive-${network}-${fingerprint}`});
}
