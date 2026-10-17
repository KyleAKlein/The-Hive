import { getChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in to open this wallet." }, { status: 401 });
  }

  const apiKey = process.env.BREEZ_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "The Breez wallet connection is not configured." }, { status: 503 });
  }

  return Response.json(
    { apiKey },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
