import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth";
import { ENV } from "../env";

const router = Router();

const healthSchema = z.object({ timestamp: z.number().min(0) });

router.get("/health", (req: Request, res: Response) => {
  const parsed = healthSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "timestamp cannot be negative" });
    return;
  }
  res.json({ ok: true });
});

const notifySchema = z.object({
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
});

router.post("/notify-owner", requireAdmin, async (req: Request, res: Response) => {
  const parsed = notifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  // Owner notifications previously went through the Manus notification service.
  // In standalone mode we log them; wire this to your own channel (email/Slack)
  // if you need real delivery.
  console.log("[Notification]", parsed.data.title, parsed.data.content);
  res.json({ success: true });
});

export default router;
