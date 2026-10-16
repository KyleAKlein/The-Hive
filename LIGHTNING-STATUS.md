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

## Embedded signup update

Join now generates a 24-word BIP39 recovery key on the device, displays its real QR code, requires matching backup verification plus three acknowledgements, and then reaches service activation. Enter restores a Hive-generated recovery key. The old sample experience remains under Explore the demo. Leaving the embedded area preserves its in-memory session; locking or reloading requires saved recovery words. Recovery words and developer credentials are not written to application storage by Hive code. Breez manages its own browser wallet state in IndexedDB.

The client adapter loads the SSR-safe Breez Spark SDK entry point, initializes its browser WebAssembly, selects a wallet-specific storage namespace, and connects using the user's recovery words. Active-wallet code supports balance, public identity, fixed-amount Lightning invoices, QR/copy/share, quoted send fees, explicit confirmation, idempotency keys, and Bitcoin-only payment history. Interrupted sends leave a non-secret local journal that blocks sending after reconnect; known payment IDs can be checked during refresh. An unknown response without a payment ID still requires manual reconciliation and remains blocked.

Breez service activation is NOT configured. A developer API key can currently be supplied in the private site's Developer service setup panel for the current browser session only; this is a temporary integration-testing path, not a deployment-wide production configuration. No keys have been requested or submitted on the user's behalf. There is no API key, seed, or wallet funding address in source control. No funding or signup fees were charged.

The SDK provides a Spark-based wallet interoperable with Lightning, rather than a standalone Lightning node. Shared Cell registration, directory identity binding, Cell-to-Cell invoice delivery, and fee collection remain unimplemented. Full network activation, restore against the service, receiving, sending, cross-device recovery, and mobile browser behavior remain untested. Do not describe this release as a complete live wallet.

Checks: 10 automated tests pass for recovery-key creation, backup matching, invalid key rejection, wallet namespace consistency, credential gating, WASM validity, and existing invoice/payment helpers. TypeScript and the production build pass. Browser QA unavailable in this managed session. The browser WASM asset is included in the generated deployment.

Provider key request: https://breez.technology/request-api-key/
Official browser SDK setup: https://sdk-doc-spark.breez.technology/guide/initializing.html
