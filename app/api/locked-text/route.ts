import { getDb } from "@/db";
import { lockedTexts } from "@/db/schema";
import { reviewInvoice } from "@/lib/lightning";
import { z } from "zod";

const offer = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(16000),
  invoice: z.string().max(4096),
  sats: z.number().int().positive().max(100000000),
});

export async function POST(request: Request) {
  const parsed = offer.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the title, text, and price." }, { status: 400 });

  let invoice;
  try {
    invoice = reviewInvoice(parsed.data.invoice, "mainnet");
  } catch {
    return Response.json({ error: "Use a valid mainnet Lightning invoice." }, { status: 400 });
  }
  if (invoice.msats !== parsed.data.sats * 1000) {
    return Response.json({ error: "The invoice must match the price." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const [created] = await getDb().insert(lockedTexts).values({
    ...parsed.data,
    id,
    invoice: invoice.invoice,
    paymentHash: invoice.hash,
    expires: invoice.expires,
  }).onConflictDoNothing().returning({ id: lockedTexts.id });

  if (!created) return Response.json({ error: "This invoice is already linked to a post." }, { status: 409 });
  return Response.json({ id }, { status: 201 });
}
