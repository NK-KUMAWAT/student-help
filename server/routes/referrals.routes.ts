import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { ReferralRewardModel, UpiVerificationModel, UserModel, WithdrawalRequestModel, type UpiVerificationDoc } from "../db";

const router = Router();

router.get("/dashboard", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user!;
  const [rewards, withdrawals, leaderboardRaw, upiVerification] = await Promise.all([
    ReferralRewardModel.find({ referrerUserId: user._id }).sort({ createdAt: -1 }).lean(),
    WithdrawalRequestModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    buildLeaderboard(),
    UpiVerificationModel.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean(),
  ]);
  res.json({
    rewards,
    withdrawals,
    leaderboard: leaderboardRaw,
    upiVerification,
    monthLabel: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date()),
  });
});

async function buildLeaderboard() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = await ReferralRewardModel.aggregate([
    { $match: { status: "credited", createdAt: { $gt: monthStart } } },
    { $group: { _id: "$referrerUserId", successfulReferrals: { $sum: 1 }, totalEarned: { $sum: "$amount" } } },
    { $sort: { totalEarned: -1 } },
    { $limit: 10 },
  ]);
  const userIds = rows.map(r => String(r._id));
  const users = await UserModel.find({ _id: { $in: userIds } }).lean();
  const nameById = new Map(users.map(u => [String(u._id), u.name]));
  return rows.map(r => ({
    userId: String(r._id),
    name: nameById.get(String(r._id)) ?? null,
    successfulReferrals: r.successfulReferrals,
    totalEarned: r.totalEarned,
  }));
}

const verifyUpiSchema = z.object({ upiId: z.string().trim().min(3).max(255) });

router.post("/verify-upi", requireAuth, async (req: Request, res: Response) => {
  const parsed = verifyUpiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const upiId = parsed.data.upiId.toLowerCase();
  if (!/^[a-z0-9._-]{2,256}@[a-z]{2,64}$/.test(upiId)) {
    res.status(400).json({ error: "Enter a valid UPI ID, for example name@bank" });
    return;
  }
  const user = (req as AuthedRequest).user!;
  const verification = await UpiVerificationModel.create({ userId: user._id, upiId, status: "verified", verifiedAt: new Date() });
  res.json({ verified: true, upiId });
});

const requestWithdrawalSchema = z.object({
  amount: z.number().int().positive(),
  payoutMethod: z.string().min(3).max(80),
  upiVerificationId: z.string().min(1),
});

router.post("/request-withdrawal", requireAuth, async (req: Request, res: Response) => {
  const parsed = requestWithdrawalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { amount, payoutMethod, upiVerificationId } = parsed.data;
  if (amount < 100) {
    res.status(400).json({ error: "Minimum withdrawal is ₹100" });
    return;
  }
  const user = (req as AuthedRequest).user!;
  const verification = await UpiVerificationModel.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean<UpiVerificationDoc>();
  if (!verification || String(verification._id) !== upiVerificationId || verification.status !== "verified") {
    res.status(400).json({ error: "Verify your UPI ID before requesting a withdrawal" });
    return;
  }
  await WithdrawalRequestModel.create({ userId: user._id, amount, payoutMethod, upiVerificationId, status: "requested" });
  res.json({ success: true, status: "requested" });
});

export default router;
