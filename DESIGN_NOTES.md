# The Hive design notes

- Use the established black-and-gold palette and soft-corner hexagons.
- Hexagons should always look polished and grid-like: consistent proportions, aligned rows and columns, balanced spacing, and deliberate sizing. Avoid scattered placement or stretched shapes.
- Reuse the rounded hexagon outline established on the landing page across onboarding, keys, and wallet screens.
- Brand phrase: “Every bit counts.” It currently appears on the wallet dashboard.

## Buckets
- One wallet with named habit and savings buckets. Buckets have no extra keys.
- Incoming deposits may split automatically by user-chosen whole percentages; the remainder stays spendable. Round bucket allocations down to whole sats and keep the remainder spendable.
- Habit completion sets aside a configurable reward and records the date in Activity.
- Family savings may start as buckets. Separate long-term wallets, security threshold prompts, and physical hexagon key backups are future phases. A growing balance does not automatically turn a bucket into a separate wallet.

## Navigation layers
- Hub retains Send, Receive, The Hive, and Activity.
- Top Cell hexagon is the My Wallet entry point. Buckets live in that second layer.
- Bucket tiles snap into a fixed grid; users can arrange via drag or accessible move controls. Save arrangement with demo data in browser storage; never save actual private keys here.

## Tile wallet redesign
- My Wallet shows the Cell centered above an open honeycomb lattice. A plus tile immediately creates a zero-balance bucket.
- Tap a bucket to deposit its preset; pencil opens label/deposit editing. Hold to drag or use Arrange; drop into empty slots or swap occupied positions.
- Dollar display currently uses a labeled demo rate of 1,000 sats per USD, not live pricing. Preserve precise sats as balances.
- Keep deposit splits and deletion inside compact advanced settings, rather than bulky cards on the canvas.
