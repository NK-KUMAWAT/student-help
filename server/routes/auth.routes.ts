import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createSessionToken, type AuthedRequest } from "../auth";
import { ENV } from "../env";
import { UserModel, sanitizeUser } from "../db";

const router = Router();

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function sessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: ENV.isProduction ? ("none" as const) : ("lax" as const),
    secure: ENV.isProduction ? isSecureRequest(req) : false,
    maxAge: ONE_YEAR_MS,
  };
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(320),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(320),
});

const resetSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
});

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { name, email, password } = parsed.data;
  const existing = await UserModel.findOne({ email });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ name, email, passwordHash, loginMethod: "email", lastSignedIn: new Date() });
  const token = await createSessionToken(user.id);
  res.cookie(COOKIE_NAME, token, sessionCookieOptions(req));
  res.json(sanitizeUser(user as never));
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const user = await UserModel.findOne({ email });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  await UserModel.updateOne({ _id: user._id }, { $set: { lastSignedIn: new Date() } });
  const token = await createSessionToken(user.id);
  res.cookie(COOKIE_NAME, token, sessionCookieOptions(req));
  res.json(sanitizeUser(user as never));
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { ...sessionCookieOptions(req), maxAge: -1 });
  res.json({ success: true });
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email } = parsed.data;
  const user = await UserModel.findOne({ email });
  // Always respond 200 to avoid leaking which emails are registered.
  if (user) {
    // 6-digit OTP code instead of a long token link.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + RESET_TTL_MS);
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { passwordResetToken: tokenHash, passwordResetExpires: expires } },
    );
    // No email service in dev — return the code so the client can show it.
    // In production this would be emailed to the user instead.
    res.json({ sent: true, ...(ENV.isProduction ? {} : { resetCode: code }) });
    return;
  }
  res.json({ sent: true });
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { token, password } = parsed.data;
  // Find any user with a non-expired reset token.
  const candidates = await UserModel.find({
    passwordResetToken: { $ne: null },
    passwordResetExpires: { $gt: new Date() },
  });
  let matchedUser: typeof candidates[number] | null = null;
  for (const candidate of candidates) {
    if (candidate.passwordResetToken && await bcrypt.compare(token, candidate.passwordResetToken)) {
      matchedUser = candidate;
      break;
    }
  }
  if (!matchedUser) {
    res.status(400).json({ error: "Reset code is invalid or has expired" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.updateOne(
    { _id: matchedUser._id },
    { $set: { passwordHash, passwordResetToken: null, passwordResetExpires: null, lastSignedIn: new Date() } },
  );
  res.json({ success: true });
});

router.get("/me", (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!user) {
    res.json(null);
    return;
  }
  res.json(sanitizeUser(user as never));
});

export default router;
