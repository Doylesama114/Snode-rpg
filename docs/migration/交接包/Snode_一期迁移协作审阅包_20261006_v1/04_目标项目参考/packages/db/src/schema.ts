import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Core identity only. Authentication providers and character rules are not defined yet.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
