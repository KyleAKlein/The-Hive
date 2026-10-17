import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";

export const dynamic = "force-dynamic";

async function requireUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in to load your profile." }, { status: 401 });

  const db = getDb();
  await db
    .insert(profiles)
    .values({
      userId: user.userId,
      email: user.email,
      name: user.fullName?.trim() || "Kyle Klein",
    })
    .onConflictDoNothing();

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1);
  return Response.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in to save your profile." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { anonymous?: unknown };
  if (typeof body.anonymous !== "boolean") {
    return Response.json({ error: "anonymous must be true or false" }, { status: 400 });
  }

  const db = getDb();
  await db
    .insert(profiles)
    .values({
      userId: user.userId,
      email: user.email,
      name: user.fullName?.trim() || "Kyle Klein",
      anonymous: body.anonymous,
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        email: user.email,
        anonymous: body.anonymous,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1);
  return Response.json({ profile }, { headers: { "Cache-Control": "private, no-store" } });
}
