import { api } from "./client";
import { setSessionToken } from "./session";
import type {
  AdminWithdrawalRow,
  ChatMessage,
  ExtractedResume,
  ReferralsDashboard,
  User,
} from "./types";

// Centralised query keys for react-query cache invalidation.
export const queryKeys = {
  authMe: ["auth", "me"] as const,
  adminWithdrawals: ["admin", "withdrawals"] as const,
  referralsDashboard: ["referrals", "dashboard"] as const,
  resumeLatest: ["resume", "latest"] as const,
};

const SESSION_TOKEN_HEADER = "x-session-token";

async function persistSessionFromHeaders(headers: Record<string, unknown> | undefined) {
  const token = headers?.[SESSION_TOKEN_HEADER];
  if (typeof token === "string" && token) {
    await setSessionToken(token);
  }
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export const authApi = {
  me: () => api.get<User | null>("/api/auth/me").then(r => r.data),
  register: async (body: { name: string; email: string; password: string }) => {
    const res = await api.post<User>("/api/auth/register", body);
    await persistSessionFromHeaders(res.headers as Record<string, unknown>);
    return res.data;
  },
  login: async (body: { email: string; password: string }) => {
    const res = await api.post<User>("/api/auth/login", body);
    await persistSessionFromHeaders(res.headers as Record<string, unknown>);
    return res.data;
  },
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

export const resumeApi = {
  extractSkills: (body: { fileName: string; mimeType: string; fileBase64: string }) =>
    api.post<ExtractedResume>("/api/resume/extract-skills", body, { timeout: 120_000 }).then(r => r.data),
  saveEdits: (body: Partial<ExtractedResume> & { resumeId: string }) =>
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

export type { ChatMessage, ExtractedResume };
