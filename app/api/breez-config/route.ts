export const dynamic = "force-dynamic";

export async function GET() {
  const cloudflareEnv = (globalThis as typeof globalThis & { __env__?: Record<string, unknown> }).__env__;
  const apiKey = (typeof cloudflareEnv?.BREEZ_API_KEY === "string" ? cloudflareEnv.BREEZ_API_KEY : process.env.BREEZ_API_KEY)?.trim();
  if (!apiKey) {
    return Response.json({ error: "The Breez wallet connection is not configured." }, { status: 503 });
  }

  return Response.json(
    { apiKey },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
