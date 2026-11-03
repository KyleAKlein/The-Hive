import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = env as unknown as { BREEZ_API_KEY?: string };
  const apiKey = runtime.BREEZ_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "The Breez wallet connection is not configured.", source: "cloudflare-runtime-binding" }, { status: 503 });
  }
  return Response.json(
    { apiKey },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
