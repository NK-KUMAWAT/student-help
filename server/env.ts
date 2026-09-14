export const ENV = {
  port: parseInt(process.env.PORT || "3001", 10),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_placement_compass",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  isProduction: process.env.NODE_ENV === "production",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // When true (dev only), spin up mongodb-memory-server instead of connecting
  // to MONGODB_URI. Set USE_IN_MEMORY_MONGO=false to use a real MongoDB.
  useInMemoryMongo: process.env.USE_IN_MEMORY_MONGO !== "false",
  // OpenAI-compatible LLM config
  llmApiKey: process.env.OPENAI_API_KEY ?? "",
  llmBaseUrl: (process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, ""),
  llmModel: process.env.OPENAI_MODEL ?? "gpt-4o",
  // Public base URL used to build file URLs accessible by the LLM provider.
  // In local dev the LLM cannot reach localhost; set this to a publicly
  // reachable URL (e.g. a tunnel) if you need resume parsing to work.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, ""),
};
