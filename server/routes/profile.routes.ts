import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { UserModel, sanitizeUser } from "../db";

const router = Router();

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json(sanitizeUser((req as AuthedRequest).user as never));
});

const updateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  headline: z.string().trim().max(200),
  university: z.string().trim().max(200),
  graduationYear: z.number().int().min(1900).max(2100).nullable(),
});

router.put("/me", requireAuth, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const user = (req as AuthedRequest).user!;
  const name = parsed.data.name?.trim() || user.name?.trim() || "";
  if (name.length < 2) {
    res.status(400).json({ error: "Please enter your name before saving your profile" });
    return;
  }
  const updated = await UserModel.findByIdAndUpdate(
    user._id,
    {
      $set: {
        name,
        headline: parsed.data.headline || null,
        university: parsed.data.university || null,
        graduationYear: parsed.data.graduationYear,
      },
    },
    { new: true },
  );
  if (!updated) {
    res.status(500).json({ error: "Could not save your profile right now" });
    return;
  }
  res.json(sanitizeUser(updated as never));
});

export default router;
