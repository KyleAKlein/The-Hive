export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.BREEZ_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "The Breez wallet connection is not configured." }, { status: 503 });
  }

  return Response.json(
    { apiKey },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
