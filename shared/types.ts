/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type User = {
  id: string;
  name: string | null;
  email: string;
  headline: string | null;
  university: string | null;
  graduationYear: number | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

export type Resume = {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  extractedSkills: string;
  createdAt: string;
};

export type ReferralReward = {
  id: string;
  referrerUserId: string;
  referredName: string;
  event: string;
  amount: number;
  status: "pending" | "credited" | "reversed";
  createdAt: string;
};

export type UpiVerification = {
  id: string;
  userId: string;
  upiId: string;
  status: "verified" | "rejected";
  verifiedAt: string | null;
  createdAt: string;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  amount: number;
  payoutMethod: string;
  upiVerificationId: string | null;
  status: "requested" | "processing" | "paid" | "rejected";
  createdAt: string;
};

export type AdminWithdrawalRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  amount: number;
  payoutMethod: string;
  status: "requested" | "processing" | "paid" | "rejected";
  createdAt: string;
  upiId: string | null;
};
