import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const user: AuthenticatedUser = {
  id: 7,
  openId: "profile-test-user",
  email: "profile@example.com",
  name: "Profile Test Student",
  headline: null,
  university: null,
  graduationYear: null,
  loginMethod: "test",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(currentUser: TrpcContext["user"]): TrpcContext {
  return {
    user: currentUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("profile", () => {
  it("returns the signed-in user profile", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(caller.profile.me()).resolves.toEqual(user);
  });

  it("requires authentication to read or update a profile", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.profile.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.profile.update({ name: "New Name", headline: "Student", university: "Campus", graduationYear: 2026 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an empty profile name before reaching the database", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(caller.profile.update({ name: "", headline: "", university: "", graduationYear: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
