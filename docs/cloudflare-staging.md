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

1. Create a D1 database named `the-hive-db`.
2. Add its database ID as the build variable `CLOUDFLARE_D1_DATABASE_ID`.
3. Apply `drizzle/0000_flaky_ghost_rider.sql` to the production database once.
4. Add `BREEZ_API_KEY` as an encrypted Worker secret before testing the real
   Bitcoin wallet.

Never commit database IDs, API keys, or Cloudflare credentials to the
repository. The application uses a local placeholder D1 ID when the build
variable is absent, so local development continues to work without production
credentials.

## Authentication limitation

The existing profile and wallet API routes expect identity headers supplied by
OpenAI Sites. A direct Cloudflare deployment can show the visual demo, but Join
and Enter remain unavailable until the staging Worker is placed behind trusted
hosted authentication. Do not make `BREEZ_API_KEY` available to a public,
unauthenticated staging Worker.
