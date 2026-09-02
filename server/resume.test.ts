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

const validInput = {
  fileName: "resume.pdf",
  mimeType: "application/pdf" as const,
  fileBase64: Buffer.from("resume text").toString("base64"),
};

describe("resume.extractSkills", () => {
  it("requires an authenticated student", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.resume.extractSkills(validInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects resumes larger than the upload limit before storage or AI work", async () => {
    const user: AuthenticatedUser = {
      id: 7,
      openId: "resume-test-user",
      email: "student@example.com",
      name: "Resume Test Student",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const caller = appRouter.createCaller(createContext(user));
    const oversizedInput = {
      ...validInput,
      fileBase64: Buffer.alloc(6 * 1024 * 1024 + 1).toString("base64"),
    };

    await expect(caller.resume.extractSkills(oversizedInput)).rejects.toThrow("Resume must be 6 MB or smaller");
  });
});
