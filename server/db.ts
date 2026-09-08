import { and, desc, eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertResume, InsertUser, referralRewards, resumes, users, upiVerifications, withdrawalRequests } from "../drizzle/schema";
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

export async function updateUserProfile(userId: number, profile: Pick<InsertUser, "name" | "headline" | "university" | "graduationYear">) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ ...profile, updatedAt: new Date() }).where(eq(users.id, userId));
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
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
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return db.select({
    userId: referralRewards.referrerUserId,
    name: users.name,
    successfulReferrals: sql<number>`count(*)`,
    totalEarned: sql<number>`coalesce(sum(${referralRewards.amount}), 0)`,
  }).from(referralRewards).innerJoin(users, eq(users.id, referralRewards.referrerUserId)).where(and(eq(referralRewards.status, "credited"), gt(referralRewards.createdAt, monthStart))).groupBy(referralRewards.referrerUserId, users.name).orderBy(sql`sum(${referralRewards.amount}) desc`).limit(10);
}

export async function getLatestUpiVerification(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(upiVerifications).where(eq(upiVerifications.userId, userId)).orderBy(desc(upiVerifications.createdAt)).limit(1);
  return result[0];
}

export async function createUpiVerification(userId: number, upiId: string, status: "verified" | "rejected") {
  const db = await getDb();
  if (!db) return undefined;
  return db.insert(upiVerifications).values({ userId, upiId, status, verifiedAt: status === "verified" ? new Date() : null });
}

export async function createWithdrawalRequest(userId: number, amount: number, payoutMethod: string, upiVerificationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return db.insert(withdrawalRequests).values({ userId, amount, payoutMethod, upiVerificationId, status: "requested" });
}

export async function getAllWithdrawalRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: withdrawalRequests.id,
    userId: withdrawalRequests.userId,
    userName: users.name,
    userEmail: users.email,
    amount: withdrawalRequests.amount,
    payoutMethod: withdrawalRequests.payoutMethod,
    status: withdrawalRequests.status,
    createdAt: withdrawalRequests.createdAt,
    upiId: upiVerifications.upiId,
  }).from(withdrawalRequests)
    .innerJoin(users, eq(users.id, withdrawalRequests.userId))
    .leftJoin(upiVerifications, eq(upiVerifications.id, withdrawalRequests.upiVerificationId))
    .orderBy(desc(withdrawalRequests.createdAt));
}

export async function updateWithdrawalRequestStatus(id: number, status: "processing" | "paid" | "rejected") {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(withdrawalRequests).set({ status }).where(eq(withdrawalRequests.id, id));
  return Boolean(result);
}
