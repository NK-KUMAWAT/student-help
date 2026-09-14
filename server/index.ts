import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { ENV } from "./env";
import { connectDb } from "./db";
import { attachUser } from "./auth";
import { UPLOAD_DIR } from "./storage";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import resumeRoutes from "./routes/resume.routes";
import supportRoutes from "./routes/support.routes";
import referralsRoutes from "./routes/referrals.routes";
import adminRoutes from "./routes/admin.routes";
import systemRoutes from "./routes/system.routes";

async function startServer() {
  await connectDb();

  const app = express();

  app.use(
    cors({
      origin: ENV.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve uploaded files from local disk.
  app.use("/uploads", express.static(UPLOAD_DIR));

  // Attach the authenticated user (if any) to every request.
  app.use(attachUser);

  // REST API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/resume", resumeRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/referrals", referralsRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/system", systemRoutes);

  // Health check
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Serve the built React app in production.
  if (ENV.isProduction) {
    const distPath = path.resolve(process.cwd(), "dist", "public");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }

  app.listen(ENV.port, () => {
    console.log(`API server running on http://localhost:${ENV.port}/`);
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
