import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createResume, createUpiVerification, createWithdrawalRequest, getAllWithdrawalRequests, getLatestResume, getLatestUpiVerification, getReferralLeaderboard, getReferralRewards, getWithdrawalRequests, updateResumeSkills, updateWithdrawalRequestStatus } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

const MAX_RESUME_BYTES = 6 * 1024 * 1024;
const allowedMimeTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"] as const;
const extractedSkillsSchema = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          level: { type: "integer", minimum: 1, maximum: 100 },
          evidence: { type: "string" },
        },
        required: ["name", "level", "evidence"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["skills", "summary"],
  additionalProperties: false,
};

const reviewedSkillsSchema = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          level: { type: "integer", minimum: 1, maximum: 100 },
          evidence: { type: "string" },
        },
        required: ["name", "level", "evidence"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
    reviewNotes: { type: "string" },
  },
  required: ["skills", "summary", "reviewNotes"],
  additionalProperties: false,
};

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  resume: router({
    extractSkills: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.enum(allowedMimeTypes),
        fileBase64: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const rawBase64 = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
        const fileBuffer = Buffer.from(rawBase64, "base64");
        if (fileBuffer.length > MAX_RESUME_BYTES) {
          throw new Error("Resume must be 6 MB or smaller");
        }
        const { key, url } = await storagePut(`resumes/${ctx.user.id}/${input.fileName}`, fileBuffer, input.mimeType);
        const signedUrl = await storageGetSignedUrl(key);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a careful resume parser. Extract only skills clearly supported by the resume. Estimate proficiency from evidence, where 100 means advanced professional experience and 1 means only a passing mention. Return concise evidence." },
            { role: "user", content: [
              { type: "text", text: "Analyze this resume and return the student's technical and professional skills." },
              { type: "file_url", file_url: { url: signedUrl, mime_type: input.mimeType === "application/pdf" ? "application/pdf" : undefined } },
            ] },
          ],
          response_format: { type: "json_schema", json_schema: { name: "resume_skills", strict: true, schema: extractedSkillsSchema } },
          max_tokens: 1200,
        });
        const content = response.choices[0]?.message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : content.map(part => part.type === "text" ? part.text : "").join(""));
        const review = await invokeLLM({
          messages: [
            { role: "system", content: "You are the second resume-review agent. Normalize duplicate skills, correct obvious naming inconsistencies, remove unsupported skills, keep evidence grounded in the supplied extraction, and produce a concise student-friendly review note." },
            { role: "user", content: `Review this first-agent resume extraction and return the corrected final skill list as JSON:\n${JSON.stringify(parsed)}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "reviewed_resume_skills", strict: true, schema: reviewedSkillsSchema } },
          max_tokens: 1400,
        });
        const reviewedContent = review.choices[0]?.message.content;
        const reviewed = JSON.parse(typeof reviewedContent === "string" ? reviewedContent : reviewedContent.map(part => part.type === "text" ? part.text : "").join(""));
        const resumeResult = await createResume({ userId: ctx.user.id, fileName: input.fileName, mimeType: input.mimeType, storageKey: key, extractedSkills: JSON.stringify(reviewed) });
        return { fileName: input.fileName, url, resumeId: Number((resumeResult as { insertId?: number } | undefined)?.insertId || 0), ...reviewed };
      }),
    saveEdits: protectedProcedure
      .input(z.object({ resumeId: z.number().int().positive(), skills: z.array(z.object({ name: z.string().min(1).max(80), level: z.number().int().min(1).max(100), evidence: z.string().max(240) })).max(40), summary: z.string().max(1000), reviewNotes: z.string().max(1000) }))
      .mutation(async ({ input, ctx }) => {
        const latest = await getLatestResume(ctx.user.id);
        if (!latest || latest.id !== input.resumeId) throw new Error("Resume not found or no longer editable");
        const saved = await updateResumeSkills(input.resumeId, ctx.user.id, JSON.stringify({ skills: input.skills, summary: input.summary, reviewNotes: input.reviewNotes }));
        if (!saved) throw new Error("Could not save resume edits");
        return { success: true as const };
      }),
  }),
  support: router({
    chat: protectedProcedure
      .input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).max(12) }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are Pathfinder Guide, a concise and encouraging support assistant for a student career workspace. Help with resume skills, roadmap, job matches, practice, referrals, notifications, and withdrawal support. Do not invent account data or promise payments. If a user needs an admin action, explain where to find the relevant workspace section." },
            ...input.messages,
          ],
          max_tokens: 500,
        });
        const content = response.choices[0]?.message.content;
        return { content: typeof content === "string" ? content : content.map((part) => part.type === "text" ? part.text : "").join("") };
      }),
  }),
  referrals: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const [rewards, withdrawals, leaderboard, upiVerification] = await Promise.all([
        getReferralRewards(ctx.user.id),
        getWithdrawalRequests(ctx.user.id),
        getReferralLeaderboard(),
        getLatestUpiVerification(ctx.user.id),
      ]);
      return { rewards, withdrawals, leaderboard, upiVerification, monthLabel: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date()) };
    }),
    verifyUpi: protectedProcedure
      .input(z.object({ upiId: z.string().trim().min(3).max(255) }))
      .mutation(async ({ input, ctx }) => {
        const upiId = input.upiId.toLowerCase();
        if (!/^[a-z0-9._-]{2,256}@[a-z]{2,64}$/.test(upiId)) throw new Error("Enter a valid UPI ID, for example name@bank");
        await createUpiVerification(ctx.user.id, upiId, "verified");
        return { verified: true as const, upiId };
      }),
    requestWithdrawal: protectedProcedure
      .input(z.object({ amount: z.number().int().positive(), payoutMethod: z.string().min(3).max(80), upiVerificationId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (input.amount < 100) throw new Error("Minimum withdrawal is ₹100");
        const verification = await getLatestUpiVerification(ctx.user.id);
        if (!verification || verification.id !== input.upiVerificationId || verification.status !== "verified") throw new Error("Verify your UPI ID before requesting a withdrawal");
        await createWithdrawalRequest(ctx.user.id, input.amount, input.payoutMethod, input.upiVerificationId);
        return { success: true as const, status: "requested" as const };
      }),
  }),
  admin: router({
    withdrawals: adminProcedure.query(() => getAllWithdrawalRequests()),
    updateWithdrawal: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["processing", "paid", "rejected"]) }))
      .mutation(async ({ input }) => {
        const updated = await updateWithdrawalRequestStatus(input.id, input.status);
        if (!updated) throw new Error("Could not update withdrawal request");
        return { success: true as const, status: input.status };
      }),
  }),
});

export type AppRouter = typeof appRouter;
