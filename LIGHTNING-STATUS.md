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

## Embedded regtest wallet

Join generates a 24-word BIP39 recovery key on the device and requires matching backup verification plus three acknowledgements. The recovery words are no longer rendered as a QR code or offered as a clipboard shortcut. Enter restores a Hive-generated recovery key. The old sample experience remains under Explore the demo. Leaving the embedded area preserves its in-memory session; locking or reloading requires the saved recovery words. Recovery words are not written to application storage by Hive code. Breez manages its own browser wallet state in IndexedDB.

The client adapter loads the SSR-safe Breez Spark SDK entry point, initializes its browser WebAssembly, selects a deterministic wallet-specific storage namespace, and connects using the user's recovery words. The adapter is deliberately locked to `regtest`; its public function no longer accepts a network or API key. Breez documents that its default regtest configuration requires no API key.

The active test wallet supports wallet-reported balance and identity, event-driven refresh, unclaimed-deposit status, Bitcoin regtest funding addresses, Spark regtest receive addresses, QR/copy support for those public addresses, and Bitcoin payment history. The UI links to the Lightspark regtest faucet, but it never calls a faucet API or requests funds automatically.

Lightning BOLT11 send and receive are deliberately disabled in the embedded regtest wallet. Breez documents that the deployed regtest environment does not have a developed Lightning Network, so Lightning behavior must later be tested on mainnet with tiny real amounts behind a separate safety gate. Mainnet selection, real payments, signup fees, Cell registration, directory identity binding, Cell-to-Cell delivery, and fee collection remain disabled and unimplemented.

No API key, seed, funding address, or wallet balance is stored in source control. No funding or signup fee was requested. Validation passes: 10 automated tests, the installed TypeScript compiler, and the Vinext production build. Local browser QA connected a public BIP39 test-vector wallet to Breez regtest without an API key, reported a zero balance, generated both address types, and locked the wallet afterward. Live faucet funding and cross-device recovery remain manual test steps.

Provider key request for the later mainnet phase: https://breez.technology/request-api-key/
Official browser SDK setup: https://sdk-doc-spark.breez.technology/guide/initializing.html
Official regtest guidance: https://sdk-doc-spark.breez.technology/guide/testing.html
