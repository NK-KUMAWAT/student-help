import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { ENV } from "./env";

// Mongoose is CommonJS; use the default export and access members off it.
const { model, models, Schema } = mongoose;
type InferSchemaType<T extends mongoose.Schema> = mongoose.InferSchemaType<T>;

// -----------------------------------------------------------------------------
// Connection
// -----------------------------------------------------------------------------

let connected = false;
let memoryServer: import("mongodb-memory-server").MongoMemoryServer | null = null;

async function resolveMongoUri(): Promise<string> {
  if (ENV.useInMemoryMongo && !ENV.isProduction) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    console.log(`[Database] Using in-memory MongoDB at ${uri}`);
    return uri;
  }
  return ENV.mongoUri;
}

export async function connectDb() {
  if (connected) return;
  try {
    mongoose.set("strictQuery", true);
    const uri = await resolveMongoUri();
    await mongoose.connect(uri);
    connected = true;
    console.log("[Database] Connected to MongoDB");
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
  }
}

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const userSchema = new Schema(
  {
    name: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    headline: { type: String, default: null },
    university: { type: String, default: null },
    graduationYear: { type: Number, default: null },
    loginMethod: { type: String, default: "email" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastSignedIn: { type: Date, default: () => new Date() },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

const resumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    storageKey: { type: String, required: true },
    extractedSkills: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

const referralRewardSchema = new Schema(
  {
    referrerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredName: { type: String, required: true },
    event: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "credited", "reversed"], default: "pending" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

const upiVerificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    upiId: { type: String, required: true },
    status: { type: String, enum: ["verified", "rejected"], default: "rejected" },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

const withdrawalRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    payoutMethod: { type: String, required: true },
    upiVerificationId: { type: Schema.Types.ObjectId, ref: "UpiVerification" },
    status: { type: String, enum: ["requested", "processing", "paid", "rejected"], default: "requested" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

const aiConversationMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: { type: [aiConversationMessageSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Mongoose exposes an `id` virtual (string of _id) by default; ensure it shows
// up in JSON responses so the API returns `id` alongside `_id`.
userSchema.virtual("id").get(function () { return (this._id as mongoose.Types.ObjectId).toString(); });
resumeSchema.virtual("id").get(function () { return (this._id as mongoose.Types.ObjectId).toString(); });
referralRewardSchema.virtual("id").get(function () { return (this._id as mongoose.Types.ObjectId).toString(); });
upiVerificationSchema.virtual("id").get(function () { return (this._id as mongoose.Types.ObjectId).toString(); });
withdrawalRequestSchema.virtual("id").get(function () { return (this._id as mongoose.Types.ObjectId).toString(); });
aiConversationSchema.virtual("id").get(function () { return (this._id as mongoose.Types.ObjectId).toString(); });

// -----------------------------------------------------------------------------
// Models
// -----------------------------------------------------------------------------

export const UserModel = models.User ?? model("User", userSchema);
export const ResumeModel = models.Resume ?? model("Resume", resumeSchema);
export const ReferralRewardModel = models.ReferralReward ?? model("ReferralReward", referralRewardSchema);
export const UpiVerificationModel = models.UpiVerification ?? model("UpiVerification", upiVerificationSchema);
export const WithdrawalRequestModel = models.WithdrawalRequest ?? model("WithdrawalRequest", withdrawalRequestSchema);
export const AiConversationModel = models.AiConversation ?? model("AiConversation", aiConversationSchema);

// -----------------------------------------------------------------------------
// Types (mirror the shape the frontend expects)
// -----------------------------------------------------------------------------

export type UserDoc = InferSchemaType<typeof userSchema> & { id: string; _id: mongoose.Types.ObjectId };
export type ResumeDoc = InferSchemaType<typeof resumeSchema> & { id: string; _id: mongoose.Types.ObjectId };
export type ReferralRewardDoc = InferSchemaType<typeof referralRewardSchema> & { id: string };
export type UpiVerificationDoc = InferSchemaType<typeof upiVerificationSchema> & { id: string; _id: import("mongoose").Types.ObjectId };
export type WithdrawalRequestDoc = InferSchemaType<typeof withdrawalRequestSchema> & { id: string };
export type AiConversationDoc = InferSchemaType<typeof aiConversationSchema> & { id: string; _id: mongoose.Types.ObjectId };

// Strip the passwordHash and mongoose internals for API responses.
// Handles both full Mongoose documents (have toObject) and lean/plain objects.
export function sanitizeUser(user: unknown): Record<string, unknown> {
  let obj: Record<string, unknown>;
  if (user && typeof (user as { toObject?: unknown }).toObject === "function") {
    // Full Mongoose document — convert to plain object including virtuals.
    obj = (user as { toObject: (opts?: Record<string, unknown>) => Record<string, unknown> }).toObject({
      virtuals: true,
    });
  } else {
    obj = { ...(user as Record<string, unknown>) };
  }
  delete obj.passwordHash;
  delete obj.__v;
  delete obj.$__;
  delete obj.$isNew;
  delete obj._doc;
  delete obj.$isDocument;
  // Ensure a string `id` is always present (lean objects lack the virtual).
  if (!obj.id && obj._id) {
    obj.id = String(obj._id);
  }
  return obj;
}

// Generate a unique, human-readable referral code like "AARAV-9K3F2C".
export async function generateUniqueReferralCode(name: string | null | undefined): Promise<string> {
  const slug = (name ?? "").trim().split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "USER";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${slug}-${randomBytes(3).toString("hex").toUpperCase()}`;
    if (!(await UserModel.exists({ referralCode: candidate }))) return candidate;
  }
  return `${slug}-${randomBytes(6).toString("hex").toUpperCase()}`;
}
