import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { getFallbackReply, hasLlmKey, invokeLLM } from "../llm";

const router = Router();

const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).max(12),
});

router.post("/chat", requireAuth, async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  try {
    let content: string;
    if (!hasLlmKey()) {
      // Fallback assistant — no API key required.
      content = getFallbackReply(parsed.data.messages);
    } else {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are Pathfinder Guide, a concise and encouraging support assistant for a student career workspace. Help with resume skills, roadmap, job matches, practice, referrals, notifications, and withdrawal support. Do not invent account data or promise payments. If a user needs an admin action, explain where to find the relevant workspace section." },
          ...parsed.data.messages,
        ],
        max_tokens: 500,
      });
      const raw = response.choices[0]?.message.content;
      content = typeof raw === "string" ? raw : raw.map(part => part.type === "text" ? part.text : "").join("");
    }
    res.json({ content });
  } catch (error) {
    console.error("[Support] Chat failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "The Help Center assistant is unavailable right now." });
  }
});

export default router;
