import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth";
import { UpiVerificationModel, UserModel, WithdrawalRequestModel } from "../db";

const router = Router();

router.get("/withdrawals", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await WithdrawalRequestModel.find().sort({ createdAt: -1 }).lean();
  const userIds = Array.from(new Set(rows.map(r => String(r.userId)))) as string[];
  const users = await UserModel.find({ _id: { $in: userIds } }).lean();
  const upiIds = Array.from(new Set(rows.map(r => r.upiVerificationId?.toString()).filter(Boolean))) as string[];
  const verifications = await UpiVerificationModel.find({ _id: { $in: upiIds } }).lean();
  const nameByEmail = new Map(users.map(u => [String(u._id), { name: u.name, email: u.email }]));
  const upiById = new Map(verifications.map(v => [String(v._id), v.upiId]));
  const result = rows.map(r => {
    const meta = nameByEmail.get(String(r.userId));
    return {
      id: String(r._id),
      userId: String(r.userId),
      userName: meta?.name ?? null,
      userEmail: meta?.email ?? null,
      amount: r.amount,
      payoutMethod: r.payoutMethod,
      status: r.status,
      createdAt: r.createdAt,
      upiId: r.upiVerificationId ? (upiById.get(String(r.upiVerificationId)) ?? null) : null,
    };
  });
  res.json(result);
});

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["processing", "paid", "rejected"]),
});

router.put("/withdrawals", requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updated = await WithdrawalRequestModel.findByIdAndUpdate(parsed.data.id, { $set: { status: parsed.data.status } }, { new: true });
  if (!updated) {
    res.status(404).json({ error: "Could not update withdrawal request" });
    return;
  }
  res.json({ success: true, status: parsed.data.status });
});

export default router;
