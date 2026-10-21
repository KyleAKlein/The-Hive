# Cloudflare staging deployment

The Hive builds as a Vinext Cloudflare Worker. Cloudflare Workers Builds can
deploy it from GitHub and keep one stable staging URL current after every push
to `main`.

## Build settings

- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm run build`
- Deploy command:
  `pnpm exec wrangler deploy --config dist/server/wrangler.json --name the-hive`

## Required Cloudflare configuration

1. Create the D1 database referenced by `vite.config.ts`.
2. Apply `drizzle/0000_flaky_ghost_rider.sql` to the production database once.
3. Add `BREEZ_API_KEY` as an encrypted Worker secret before testing the real
   Bitcoin wallet.

Cloudflare D1 database IDs are resource identifiers and are safe to keep in
deployment configuration. Never commit API keys or Cloudflare credentials to
the repository. `CLOUDFLARE_D1_DATABASE_ID` can override the configured D1 ID
for a different Cloudflare account.

## Authentication limitation

The existing profile and wallet API routes expect identity headers supplied by
OpenAI Sites. A direct Cloudflare deployment can show the visual demo, but Join
and Enter remain unavailable until the staging Worker is placed behind trusted
hosted authentication. Do not make `BREEZ_API_KEY` available to a public,
unauthenticated staging Worker.
