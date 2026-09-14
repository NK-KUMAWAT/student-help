import type {
  AdminWithdrawalRow,
  ReferralReward,
  UpiVerification,
  User,
  WithdrawalRequest,
} from "@shared/types";
import axios from "axios";

// In dev, Vite proxies /api to the Express server (see vite.config.ts).
// In production, set VITE_API_URL to the API origin if frontend and API are
// served from different hosts.
const baseURL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
});

// Centralised query keys for react-query cache invalidation.
export const queryKeys = {
  authMe: ["auth", "me"] as const,
  adminWithdrawals: ["admin", "withdrawals"] as const,
  referralsDashboard: ["referrals", "dashboard"] as const,
  resumeLatest: ["resume", "latest"] as const,
};

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export const authApi = {
  me: () => api.get<User | null>("/api/auth/me").then(r => r.data),
  register: (body: { name: string; email: string; password: string }) =>
    api.post<User>("/api/auth/register", body).then(r => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<User>("/api/auth/login", body).then(r => r.data),
  logout: () => api.post<{ success: boolean }>("/api/auth/logout").then(r => r.data),
  forgotPassword: (body: { email: string }) =>
    api.post<{ sent: boolean; resetCode?: string }>("/api/auth/forgot-password", body).then(r => r.data),
  resetPassword: (body: { token: string; password: string }) =>
    api.post<{ success: boolean }>("/api/auth/reset-password", body).then(r => r.data),
};

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

export const profileApi = {
  me: () => api.get<User>("/api/profile/me").then(r => r.data),
  update: (body: { name?: string; headline: string; university: string; graduationYear: number | null }) =>
    api.put<User>("/api/profile/me", body).then(r => r.data),
};

// -----------------------------------------------------------------------------
// Resume
// -----------------------------------------------------------------------------

export type ExtractedResume = {
  fileName: string;
  url: string;
  resumeId: string;
  skills: { name: string; level: number; evidence: string }[];
  summary: string;
  reviewNotes: string;
};

export const resumeApi = {
  extractSkills: (body: { fileName: string; mimeType: string; fileBase64: string }) =>
    api.post<ExtractedResume>("/api/resume/extract-skills", body).then(r => r.data),
  saveEdits: (body: { resumeId: string; skills: { name: string; level: number; evidence: string }[]; summary: string; reviewNotes: string }) =>
    api.put<{ success: boolean }>("/api/resume/save-edits", body).then(r => r.data),
  latest: () => api.get<ExtractedResume | null>("/api/resume/latest").then(r => r.data),
};

// -----------------------------------------------------------------------------
// Support
// -----------------------------------------------------------------------------

export const supportApi = {
  chat: (body: { messages: { role: "user" | "assistant"; content: string }[] }) =>
    api.post<{ content: string }>("/api/support/chat", body).then(r => r.data),
};

// -----------------------------------------------------------------------------
// Referrals
// -----------------------------------------------------------------------------

export type ReferralsDashboard = {
  rewards: ReferralReward[];
  withdrawals: WithdrawalRequest[];
  leaderboard: { userId: string; name: string | null; successfulReferrals: number; totalEarned: number }[];
  upiVerification: UpiVerification | null;
  monthLabel: string;
};

export const referralsApi = {
  dashboard: () => api.get<ReferralsDashboard>("/api/referrals/dashboard").then(r => r.data),
  verifyUpi: (body: { upiId: string }) =>
    api.post<{ verified: boolean; upiId: string }>("/api/referrals/verify-upi", body).then(r => r.data),
  requestWithdrawal: (body: { amount: number; payoutMethod: string; upiVerificationId: string }) =>
    api.post<{ success: boolean; status: string }>("/api/referrals/request-withdrawal", body).then(r => r.data),
};

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

export const adminApi = {
  withdrawals: () => api.get<AdminWithdrawalRow[]>("/api/admin/withdrawals").then(r => r.data),
  updateWithdrawal: (body: { id: string; status: "processing" | "paid" | "rejected" }) =>
    api.put<{ success: boolean; status: string }>("/api/admin/withdrawals", body).then(r => r.data),
};
