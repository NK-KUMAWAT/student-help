// Shared types ported from ../shared/types.ts and client/src/lib/api.ts.
// Kept as a local copy so the mobile app stays a standalone package.

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

// ---- Resume ----

export type EducationEntry = { institution: string; degree: string; year: string; score: string };
export type ExperienceEntry = { company: string; role: string; duration: string; description: string };
export type ProjectEntry = { title: string; description: string; technologies: string };
export type CertificationEntry = { name: string; issuer: string; date: string };
export type LanguageEntry = { name: string; proficiency: string };
export type PersonalDetails = { name: string; email: string; phone: string; location: string; links: string[] };

export type ExtractedResume = {
  fileName: string;
  url?: string;
  resumeId: string;
  skills: { name: string; level: number; evidence: string }[];
  summary: string;
  reviewNotes: string;
  rawText?: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  achievements: string[];
  languages: LanguageEntry[];
  personalDetails: PersonalDetails;
};

export type ReferralsDashboard = {
  rewards: ReferralReward[];
  withdrawals: WithdrawalRequest[];
  leaderboard: { userId: string; name: string | null; successfulReferrals: number; totalEarned: number }[];
  upiVerification: UpiVerification | null;
  monthLabel: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const UNAUTHED_ERR_MSG = "Please login (10001)";
