import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertResume, InsertUser, referralRewards, resumes, users, withdrawalRequests } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createResume(resume: InsertResume) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save resume: database not available");
    return undefined;
  }
  const result = await db.insert(resumes).values(resume);
  return result;
}

export async function getLatestResume(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt)).limit(1);
  return result[0];
}

export async function updateResumeSkills(id: number, userId: number, extractedSkills: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(resumes)
    .set({ extractedSkills })
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  return Boolean(result);
}

export async function getReferralRewards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referralRewards).where(eq(referralRewards.referrerUserId, userId)).orderBy(desc(referralRewards.createdAt));
}

export async function getWithdrawalRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId)).orderBy(desc(withdrawalRequests.createdAt));
}

export async function getReferralLeaderboard() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    userId: referralRewards.referrerUserId,
    successfulReferrals: sql<number>`count(*)`,
    totalEarned: sql<number>`coalesce(sum(${referralRewards.amount}), 0)`,
  }).from(referralRewards).where(eq(referralRewards.status, "credited")).groupBy(referralRewards.referrerUserId).orderBy(sql`sum(${referralRewards.amount}) desc`).limit(10);
}

export async function createWithdrawalRequest(userId: number, amount: number, payoutMethod: string) {
  const db = await getDb();
  if (!db) return undefined;
  return db.insert(withdrawalRequests).values({ userId, amount, payoutMethod, status: "requested" });
}
