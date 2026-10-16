import { decode } from 'light-bolt11-decoder';

export function satsToMsats(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new Error('Enter a whole number of sats greater than zero.');
  const sats = Number(value);
  if (!Number.isSafeInteger(sats) || sats > 100000000) throw new Error('Use an amount of at most 100,000,000 sats.');
  return sats * 1000;
}
export function validateConnection(value: string): string {
  const text = value.trim();
  const url = new URL(text);
  if (url.protocol !== 'nostr+walletconnect:' || !/^[a-f0-9]{64}$/i.test(url.hostname) || !/^[a-f0-9]{64}$/i.test(url.searchParams.get('secret') || '')) throw new Error('Enter a valid NWC connection from your wallet, not a wallet recovery key.');
  const relays = url.searchParams.getAll('relay');
  if (!relays.length || relays.some(relay => new URL(relay).protocol !== 'wss:')) throw new Error('Your wallet connection must use a secure wss:// relay.');
  return text;
}
export function reviewInvoice(value: string, network: string, allowExpired = false) {
  const invoice = value.trim().replace(/^lightning:/i, '').toLowerCase();
  const prefix = network === 'mainnet' ? 'lnbc' : network === 'regtest' ? 'lnbcrt' : network === 'signet' || network === 'testnet' ? 'lntb' : '';
  if (!prefix || !invoice.startsWith(prefix) || (network === 'mainnet' && invoice.startsWith('lnbcrt'))) throw new Error('Invoice network must match the connected wallet.');
  const parsed = decode(invoice);
  const amount = parsed.sections.find(s => s.name === 'amount')?.value;
  const hash = parsed.sections.find(s => s.name === 'payment_hash')?.value;
  if (!/^[a-f0-9]{64}$/i.test(String(hash))) throw new Error('Invoice has no valid payment hash.');
  const msats = Number(amount);
  if (!amount || !Number.isSafeInteger(msats) || msats <= 0) throw new Error('Use an invoice with a fixed amount.');
  const timestamp = Number(parsed.sections.find(s => s.name === 'timestamp')?.value);
  const expires = parsed.expiry ?? timestamp + 3600;
  if (!Number.isFinite(expires) || (!allowExpired && expires <= Date.now() / 1000)) throw new Error('This invoice has expired.');
  return {invoice, msats, hash: String(hash), expires, description: String(parsed.sections.find(s => s.name === 'description')?.value || 'Lightning payment')};
}
export async function verifyPreimage(preimage: string, paymentHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(preimage)) return false;
  const bytes = Uint8Array.from(preimage.match(/../g)!, s => parseInt(s, 16));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') === paymentHash.toLowerCase();
}
