import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lockedTexts } from "@/db/schema";
import { verifyPreimage } from "@/lib/lightning";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const [offer] = await getDb().select({
    title: lockedTexts.title,
    sats: lockedTexts.sats,
    invoice: lockedTexts.invoice,
    expires: lockedTexts.expires,
  }).from(lockedTexts).where(eq(lockedTexts.id, id));
  if (!offer) return Response.json({ error: "Locked text link not found." }, { status: 404, headers });
  return Response.json(offer, { headers });
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const input: unknown = await request.json().catch(() => null);
  const preimage = input && typeof input === "object" && "preimage" in input ? input.preimage : null;
  const db = getDb();
  const [offer] = await db.select({ hash: lockedTexts.paymentHash })
    .from(lockedTexts).where(eq(lockedTexts.id, id));
  if (!offer || typeof preimage !== "string" || !await verifyPreimage(preimage.trim(), offer.hash)) {
    return Response.json({ error: "Enter the payment preimage for this invoice." }, { status: 403, headers });
  }
  const [post] = await db.select({ body: lockedTexts.body }).from(lockedTexts).where(eq(lockedTexts.id, id));
  return Response.json(post, { headers });
}
