import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  cellNumber: text("cell_number").notNull().default("D-313"),
  tag: text("tag").notNull().default("Hive member"),
  anonymous: integer("anonymous", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const lockedTexts = sqliteTable("locked_texts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  invoice: text("invoice").notNull(),
  paymentHash: text("payment_hash").notNull().unique(),
  sats: integer("sats").notNull(),
  expires: integer("expires").notNull(),
});
