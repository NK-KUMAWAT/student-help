import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { ResumeModel, type ResumeDoc } from "../db";
import { extractResumeText, getFallbackResumeExtraction, hasLlmKey, invokeLLM } from "../llm";
import { storagePut } from "../storage";

const router = Router();

const MAX_RESUME_BYTES = 6 * 1024 * 1024;
const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;

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

const extractSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(allowedMimeTypes),
  fileBase64: z.string().min(1),
});

// LLMs sometimes wrap JSON in markdown fences or trail off — strip fences and
// take the outermost object before parsing.
function parseJsonObject<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("LLM returned no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

router.post("/extract-skills", requireAuth, async (req: Request, res: Response) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { fileName, mimeType, fileBase64 } = parsed.data;
  const user = (req as AuthedRequest).user!;

  const rawBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
  const fileBuffer = Buffer.from(rawBase64, "base64");
  if (fileBuffer.length > MAX_RESUME_BYTES) {
    res.status(400).json({ error: "Resume must be 6 MB or smaller" });
    return;
  }

  try {
    const { key, url } = await storagePut(`resumes/${String(user._id)}/${fileName}`, fileBuffer, mimeType);

    let reviewed: { skills: { name: string; level: number; evidence: string }[]; summary: string; reviewNotes: string; rawText?: string; education?: { institution: string; degree: string; year: string; score: string }[]; experience?: { company: string; role: string; duration: string; description: string }[]; projects?: { title: string; description: string; technologies: string }[]; certifications?: { name: string; issuer: string; date: string }[]; achievements?: string[]; languages?: { name: string; proficiency: string }[]; personalDetails?: { name: string; email: string; phone: string; location: string; links: string[] } };

    if (!hasLlmKey()) {
      // Fallback extraction — no API key required.
      reviewed = await getFallbackResumeExtraction(fileBuffer, mimeType);
    } else {
      // Send extracted text instead of a file URL — remote providers cannot
      // fetch localhost uploads, and Gemini rejects file_url content parts.
      const resumeText = (await extractResumeText(fileBuffer)).trim();
      if (resumeText.length < 60) {
        reviewed = await getFallbackResumeExtraction(fileBuffer, mimeType);
      } else {
        try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a careful resume parser. Extract only skills clearly supported by the resume. Estimate proficiency from evidence, where 100 means advanced professional experience and 1 means only a passing mention. Return concise evidence." },
            { role: "user", content: `Analyze this resume and return the student's technical and professional skills.\n\nRESUME TEXT (extracted from the uploaded file "${fileName}"):\n${resumeText.slice(0, 14000)}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "resume_skills", strict: true, schema: extractedSkillsSchema } },
          max_tokens: 1200,
        });

        const content = response.choices[0]?.message.content;
        const parsed = parseJsonObject(typeof content === "string" ? content : content.map(part => part.type === "text" ? part.text : "").join(""));

        const review = await invokeLLM({
          messages: [
            { role: "system", content: "You are the second resume-review agent. Normalize duplicate skills, correct obvious naming inconsistencies, remove unsupported skills, keep evidence grounded in the supplied extraction, and produce a concise student-friendly review note." },
            { role: "user", content: `Review this first-agent resume extraction and return the corrected final skill list as JSON:\n${JSON.stringify(parsed)}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "reviewed_resume_skills", strict: true, schema: reviewedSkillsSchema } },
          max_tokens: 1400,
        });

        const reviewedContent = review.choices[0]?.message.content;
        reviewed = parseJsonObject(typeof reviewedContent === "string" ? reviewedContent : reviewedContent.map(part => part.type === "text" ? part.text : "").join(""));
        if (!reviewed.rawText) reviewed.rawText = resumeText.slice(0, 20000);
        } catch (llmError) {
          // Provider error, rate limit, or malformed JSON — degrade to the
          // deterministic extractor instead of failing the upload.
          console.warn("[Resume] LLM extraction failed, using fallback extractor:", llmError);
          reviewed = await getFallbackResumeExtraction(fileBuffer, mimeType);
        }
      }
    }

    const resume = await ResumeModel.create({
      userId: user._id,
      fileName,
      mimeType,
      storageKey: key,
      extractedSkills: JSON.stringify(reviewed),
    });

    res.json({
      fileName,
      url,
      resumeId: resume.id,
      skills: reviewed.skills ?? [],
      summary: reviewed.summary ?? "",
      reviewNotes: reviewed.reviewNotes ?? "",
      rawText: reviewed.rawText ?? "",
      education: reviewed.education ?? [],
      experience: reviewed.experience ?? [],
      projects: reviewed.projects ?? [],
      certifications: reviewed.certifications ?? [],
      achievements: reviewed.achievements ?? [],
      languages: reviewed.languages ?? [],
      personalDetails: reviewed.personalDetails ?? { name: "", email: "", phone: "", location: "", links: [] },
    });
  } catch (error) {
    console.error("[Resume] Extraction failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Resume extraction failed" });
  }
});

const saveEditsSchema = z.object({
  resumeId: z.string().min(1),
  skills: z.array(z.object({ name: z.string().min(1).max(80), level: z.number().int().min(1).max(100), evidence: z.string().max(240) })).max(40),
  summary: z.string().max(1000),
  reviewNotes: z.string().max(1000),
  education: z.array(z.object({ institution: z.string(), degree: z.string(), year: z.string(), score: z.string() })).optional(),
  experience: z.array(z.object({ company: z.string(), role: z.string(), duration: z.string(), description: z.string() })).optional(),
  projects: z.array(z.object({ title: z.string(), description: z.string(), technologies: z.string() })).optional(),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string(), date: z.string() })).optional(),
  achievements: z.array(z.string()).optional(),
  languages: z.array(z.object({ name: z.string(), proficiency: z.string() })).optional(),
  personalDetails: z.object({ name: z.string(), email: z.string(), phone: z.string(), location: z.string(), links: z.array(z.string()) }).optional(),
});

router.put("/save-edits", requireAuth, async (req: Request, res: Response) => {
  const parsed = saveEditsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const user = (req as AuthedRequest).user!;
  const latest = await ResumeModel.findOne({ userId: user._id }).sort({ createdAt: -1 });
  if (!latest || latest.id !== parsed.data.resumeId) {
    res.status(404).json({ error: "Resume not found or no longer editable" });
    return;
  }
  const { resumeId, ...saveData } = parsed.data;
  latest.extractedSkills = JSON.stringify(saveData);
  await latest.save();
  res.json({ success: true });
});

router.get("/latest", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user!;
  const latest = await ResumeModel.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean<ResumeDoc>();
  if (!latest) {
    res.json(null);
    return;
  }
  try {
    const parsed = JSON.parse(latest.extractedSkills);
    res.json({
      resumeId: String(latest._id),
      fileName: latest.fileName,
      skills: parsed.skills ?? [],
      summary: parsed.summary ?? "",
      reviewNotes: parsed.reviewNotes ?? "",
      rawText: parsed.rawText ?? "",
      education: parsed.education ?? [],
      experience: parsed.experience ?? [],
      projects: parsed.projects ?? [],
      certifications: parsed.certifications ?? [],
      achievements: parsed.achievements ?? [],
      languages: parsed.languages ?? [],
      personalDetails: parsed.personalDetails ?? { name: "", email: "", phone: "", location: "", links: [] },
    });
  } catch {
    res.json(null);
  }
});

export default router;
