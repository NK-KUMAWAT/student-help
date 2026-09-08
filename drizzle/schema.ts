import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const resumes = mysqlTable("resumes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  extractedSkills: text("extractedSkills").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const referralRewards = mysqlTable("referralRewards", {
  id: int("id").autoincrement().primaryKey(),
  referrerUserId: int("referrerUserId").notNull(),
  referredName: varchar("referredName", { length: 160 }).notNull(),
  event: varchar("event", { length: 120 }).notNull(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "credited", "reversed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const withdrawalRequests = mysqlTable("withdrawalRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  payoutMethod: varchar("payoutMethod", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["requested", "processing", "paid", "rejected"]).default("requested").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = typeof resumes.$inferInsert;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
