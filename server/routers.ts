import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createResume } from "./db";
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
        await createResume({ userId: ctx.user.id, fileName: input.fileName, mimeType: input.mimeType, storageKey: key, extractedSkills: JSON.stringify(parsed) });
        return { fileName: input.fileName, url, ...parsed };
      }),
  }),
});

export type AppRouter = typeof appRouter;
