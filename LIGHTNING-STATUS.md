# Lightning integration

The Wallet screen links to a separate connected-wallet area. It uses the Alby NWCClient from @getalby/sdk/nwc, via a client-side dynamic import. No wallet credentials are sent to Hive's application server or persisted by Hive. NWC app credentials are spending credentials, not recovery keys. Wallet custody depends on the selected wallet.

Implemented: connection and disconnection, wallet-reported network and balance, permission-aware actions, fixed-amount BOLT11 invoice creation, real local SVG QR encoding, invoice copy/share, manual payment lookup, invoice review, explicit send confirmation, preimage verification, and wallet transaction history. Amounts in NWC requests are millisatoshis; the UI displays sats without a fabricated USD rate.

Payment attempts with unknown outcomes are blocked from immediate retry. Only the pending public invoice is stored locally, keyed by the connection public key, so reconnection can check its outcome. Secrets stay in memory. There is no automated spending, funding, or fee collection.

Demo Cell identities, demo signup/private keys, directory members, buckets, local demo invoice delivery, and demo balances remain separate and are not linked to the connected wallet. This release does not create embedded self-custodial wallets, register unique Cells, implement shared accounts, or deliver invoices between Cells. No wallet or Bitcoin is required to browse the existing demo. A compatible wallet connection is required to exercise NWC operations.

Validation: TypeScript, production build, and four automated tests covering amount conversion, secure connection parsing, invoice network/expiry/checksum/amount review, and matching payment preimages. No funded-wallet, relay, or browser end-to-end test has been performed. Live integration is unverified pending wallet testing. Browser QA was unavailable in the managed environment.

References:
- https://docs.nwc.dev/bitcoin-apps-and-websites/code-examples
- https://guides.getalby.com/developer-guide/developer-guide/nostr-wallet-connect-api/building-lightning-apps/nwc-js-sdk
- Installed SDK TypeScript declarations determine current imports and API types.
