import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { SignJWT, jwtVerify } from "jose";
import type { NextFunction, Request, Response } from "express";
import { ENV } from "./env";
import { UserModel, sanitizeUser, type UserDoc } from "./db";

const secretKey = new TextEncoder().encode(ENV.jwtSecret);

export type SessionPayload = {
  userId: string;
};

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secretKey);
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    const userId = (payload as Record<string, unknown>).userId;
    if (typeof userId !== "string") return null;
    return { userId };
  } catch {
    return null;
  }
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const pair = header.split(";").map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return pair?.slice(name.length + 1);
}

// Attach `req.user` when a valid session is present, but never reject the
// request — use `requireAuth` for protected routes.
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = getCookie(req, COOKIE_NAME);
  const session = await verifySessionToken(token);
  if (session) {
    const user = await UserModel.findById(session.userId).lean<UserDoc>();
    if (user) (req as AuthedRequest).user = user;
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user) {
    res.status(401).json({ error: "Please login (10001)" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "You do not have required permission (10002)" });
    return;
  }
  next();
}

export type AuthedRequest = Request & { user?: UserDoc };

export { sanitizeUser };
