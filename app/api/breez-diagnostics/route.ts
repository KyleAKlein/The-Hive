import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

// Temporary, secret-safe diagnostics for the preview deployment.
// Never return environment values, key lengths, or secret names from this route.
export async function GET() {
  const runtime = env as unknown as Record<string, unknown>;
  const cfValue = runtime?.BREEZ_API_KEY;
  const nodeValue = process.env.BREEZ_API_KEY;
  return Response.json(
    {
      diagnosticVersion: "breez-bindings-2026-11-03-v1",
      cloudflareBindingPresent: typeof cfValue === "string" && cfValue.trim().length > 0,
      nodeEnvPresent: typeof nodeValue === "string" && nodeValue.trim().length > 0,
      cloudflareRuntimeAvailable: typeof runtime === "object" && runtime !== null,
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
