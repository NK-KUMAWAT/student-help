import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const user: AuthenticatedUser = {
  id: 21,
  openId: "referral-test-user",
  email: "referrer@example.com",
  name: "Referral Test Student",
  loginMethod: "test",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("referrals", () => {
  it("requires authentication to read the referral dashboard", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.referrals.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects withdrawal requests below the minimum amount", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(caller.referrals.requestWithdrawal({ amount: 50, payoutMethod: "UPI", upiVerificationId: 1 })).rejects.toThrow("Minimum withdrawal is ₹100");
  });

  it("rejects malformed UPI IDs before verification", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(caller.referrals.verifyUpi({ upiId: "not-an-upi" })).rejects.toThrow("Enter a valid UPI ID");
  });
});
