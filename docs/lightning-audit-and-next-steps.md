# The Hive — Lightning audit and next steps

Audit recorded: 2026-11-02. This is a source-inspection summary, not a successful end-to-end or security certification.

## Current implementation (source observations)

- `lib/hive-wallet.ts` currently selects `mainnet` and sets `HIVE_LIGHTNING_ENABLED = true`. It connects via the Breez Spark browser SDK and fetches configuration from `/api/breez-config`.
- `app/api/breez-config/route.ts` returns a configured `BREEZ_API_KEY` to the browser. This is a client-consumed provider credential; assess provider restrictions, abuse exposure and deployment configuration before production use.
- `components/hive-wallet.tsx` includes Lightning invoice creation, payment UI, funding flow, wallet backup and recovery interactions. Source presence does **not** demonstrate successful mainnet transfers.
- `lib/hive-wallet.ts` creates 12-word BIP39 recovery phrases (128-bit entropy). The previous `LIGHTNING-STATUS.md` describes a 24-word regtest-only version and is **outdated relative to current code**; reconcile documentation before release.
- `app/page.tsx` still contains demo balances, demo invoices, placeholder QR information, and simulated activity. These are not connected to real member-to-member transfers.
- `db/schema.ts` has profile fields including `cellNumber`, currently defaulting to `D-313`; this does not establish unique Cell registration or secure wallet-to-Cell ownership.

## Safety gates — complete before handling user funds

1. **Wallet security audit:** Review seed generation, local persistence (`lib/local-wallet-vault.ts`), session lifecycle, secret handling, logging, XSS exposure, QR/private-key presentation, error handling, and provider-key exposure. Distinguish wallet recovery material from public identity keys. Never commit or request a real seed phrase.
2. **Recovery verification:** Create a disposable test wallet, lock/reload, restore in a clean browser/device, and verify the same wallet identity and balances. Confirm failure modes and backup warnings.
3. **Breez configuration:** Verify environment configuration, provider permissions and mainnet requirements. Do not hard-code credentials or assume the existing endpoint is safe for unrestricted public use.
4. **Tiny real payment:** Only after security/recovery checks and explicit approval, create and pay a minimal mainnet Lightning invoice between independently controlled test wallets. Verify amount, fees, recipient receipt, transaction status, duplicate-send protection, and error handling. No automated funding or transfers.
5. **Cell ownership:** Design server-enforced unique Cell assignment, wallet-to-Cell binding with cryptographic proof, public/private directory controls, and anti-impersonation safeguards.
6. **Cell-to-cell payments:** Resolve Cell to a currently valid payment request or supported address, obtain recipient confirmation where appropriate, show fees, require explicit sender approval, and test successful and failed payments. Do not treat a public identity key as a Lightning invoice.

## First real MVP acceptance test

Two independent users create and recover their wallets, receive distinct verified Cells, find one another by Cell, and complete one explicitly approved tiny Lightning transfer with correct balances and receipt. Demo activity must be clearly separated from live activity throughout.

## Release constraints

- No real-money activation fee, automatic transfer, or 6% event collection until explicitly designed, approved and tested.
- Do not claim guaranteed payment routing, universal KYC exemption, fee certainty, or recovery guarantees.
- Treat passing unit tests and builds as necessary but insufficient; browser and funded-wallet end-to-end QA are still required.
- Update `LIGHTNING-STATUS.md` to reflect actual code and verified tests after the implementation is reconciled.

## Source files reviewed

`LIGHTNING-STATUS.md`, `README.md`, `lib/hive-wallet.ts`, `app/api/breez-config/route.ts`, `components/hive-wallet.tsx`, `app/page.tsx`, `db/schema.ts`, and repository tree. Some related files and complete payment flows require deeper inspection before asserting security or operational readiness.
