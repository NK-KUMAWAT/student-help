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
  register: (body: { name: string; email: string; password: string; referralCode?: string }) =>
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

// The API may omit optional arrays (older resumes or partial extractions) —
// fill defaults so UI code can always read .length safely.
function normalizeResume(data: ExtractedResume | null): ExtractedResume | null {
  if (!data) return data;
  return {
    ...data,
    skills: data.skills ?? [],
    summary: data.summary ?? "",
    reviewNotes: data.reviewNotes ?? "",
    rawText: data.rawText ?? "",
    education: data.education ?? [],
    experience: data.experience ?? [],
    projects: data.projects ?? [],
    certifications: data.certifications ?? [],
    achievements: data.achievements ?? [],
    languages: data.languages ?? [],
    personalDetails: data.personalDetails ?? { name: "", email: "", phone: "", location: "", links: [] },
  };
}

export const resumeApi = {
  extractSkills: (body: { fileName: string; mimeType: string; fileBase64: string }) =>
    api.post<ExtractedResume>("/api/resume/extract-skills", body).then(r => normalizeResume(r.data)),
  saveEdits: (body: Partial<ExtractedResume> & { resumeId: string }) =>
    api.put<{ success: boolean }>("/api/resume/save-edits", body).then(r => r.data),
  latest: () => api.get<ExtractedResume | null>("/api/resume/latest").then(r => normalizeResume(r.data)),
};

// -----------------------------------------------------------------------------
// Support
// -----------------------------------------------------------------------------

export const supportApi = {
  chat: (body: { messages: { role: "user" | "assistant"; content: string }[] }) =>
    api.post<{ content: string }>("/api/support/chat", body).then(r => r.data),
};

// -----------------------------------------------------------------------------
// AI Agent (Practice Room)
// -----------------------------------------------------------------------------

export type AiAgentMessage = { role: "user" | "assistant"; content: string };

export type AiAgentChatResponse = {
  conversationId: string;
  message: AiAgentMessage;
  hasResume: boolean;
  provider?: "llm" | "fallback";
};

export type AiAgentStreamEvent =
  | { type: "meta"; conversationId: string; hasResume: boolean }
  | { type: "delta"; text: string }
  | { type: "done"; provider?: "llm" | "fallback" }
  | { type: "error"; error: string };

export const aiAgentApi = {
  chat: (body: { message: string; conversationId?: string }) =>
    api.post<AiAgentChatResponse>("/api/ai-agent/chat", body).then(r => r.data),

  // Server-sent events — yields meta → delta* → done (or error). Uses fetch
  // instead of axios because axios buffers the whole response body.
  chatStream: async function* (body: { message: string; conversationId?: string }): AsyncGenerator<AiAgentStreamEvent> {
    const response = await fetch(`${baseURL}/api/ai-agent/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, stream: true }),
      signal: AbortSignal.timeout(75_000),
    });
    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      yield { type: "error", error: data?.error ?? `Request failed (${response.status})` };
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find(line => line.startsWith("data:"));
          if (!dataLine) continue;
          try {
            yield JSON.parse(dataLine.slice(5).trim()) as AiAgentStreamEvent;
          } catch {
            // Skip malformed SSE chunks.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

// -----------------------------------------------------------------------------
// Referrals
// -----------------------------------------------------------------------------

export type ReferralsDashboard = {
  rewards: ReferralReward[];
  withdrawals: WithdrawalRequest[];
  leaderboard: { userId: string; name: string | null; successfulReferrals: number; totalEarned: number }[];
  upiVerification: UpiVerification | null;
  referralCode: string;
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
