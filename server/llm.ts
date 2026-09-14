import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  max_tokens?: number;
  response_format?: ResponseFormat;
  model?: string;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string | Array<TextContent | ImageContent | FileContent>; tool_calls?: unknown[] };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role: message.role, name: message.name, content: contentParts[0].text };
  }
  return { role: message.role, name: message.name, content: contentParts };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const computeBackoffDelay = (attempt: number, retryAfterMs?: number): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

async function fetchWithBackoff(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) return response;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try { await response.body?.cancel(); } catch {}
      console.warn(`LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`);
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(`LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`);
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.llmApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const payload: Record<string, unknown> = {
    model: params.model ?? ENV.llmModel,
    messages: params.messages.map(normalizeMessage),
  };
  if (typeof params.max_tokens === "number") payload.max_tokens = params.max_tokens;
  if (params.response_format) payload.response_format = params.response_format;

  const response = await fetchWithBackoff(`${ENV.llmBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ENV.llmApiKey}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }
  return (await response.json()) as InvokeResult;
}

// -----------------------------------------------------------------------------
// Fallback assistant (no API key required)
// -----------------------------------------------------------------------------

const FALLBACK_SUGGESTIONS: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["resume", "upload", "cv", "upload resume"],
    answer:
      "To upload your resume:\n1. Open the **Resume** tab from the sidebar.\n2. Click the upload area and choose a PDF or DOCX file.\n3. The AI will extract your skills automatically.\n4. Review and edit the extracted skills, then click **Save**.\n\nTip: Use a clean, text-based resume for the best extraction results.",
  },
  {
    keywords: ["skill", "skills", "extract", "extraction"],
    answer:
      "Skill extraction works by reading your uploaded resume and identifying technical and soft skills with proficiency levels. After extraction you can edit any skill's level (1-5) and add evidence before saving it to your profile.",
  },
  {
    keywords: ["roadmap", "learning", "plan", "study"],
    answer:
      "Your Skill Roadmap is built from the gap between your current skills and the roles you're targeting. Each step shows what to learn, suggested resources, and an estimated time to close the gap. Check the **Roadmap** tab to see your personalized path.",
  },
  {
    keywords: ["match", "job", "jobs", "role", "career"],
    answer:
      "Job Matches are ranked by how well your current skills align with each role. Open the **Matches** tab to see roles sorted by match percentage. You can search by company, role, or location, and shortlist the ones you like.",
  },
  {
    keywords: ["practice", "interview", "mock"],
    answer:
      "The Practice Room lets you rehearse common interview questions for your target roles. Open the **Practice** tab, pick a topic, and work through the prompts. Your answers stay private to you.",
  },
  {
    keywords: ["referral", "refer", "invite", "friend"],
    answer:
      "Earn rewards by referring friends:\n1. Open the **Referrals** tab.\n2. Share your referral link with friends.\n3. When a friend signs up and completes a milestone, a reward is credited to your account.\n4. Track your rewards and leaderboard rank on the same page.",
  },
  {
    keywords: ["withdraw", "payout", "money", "cash out", "balance"],
    answer:
      "To withdraw your referral earnings:\n1. Open the **Referrals** tab.\n2. Verify your UPI ID first (one-time step).\n3. Click **Request Withdrawal** and enter the amount.\n4. An admin will review and process your request.\n\nYou can track the status (requested → processing → paid) on the same page.",
  },
  {
    keywords: ["upi", "verify upi", "payment", "verify"],
    answer:
      "To verify your UPI ID:\n1. Go to the **Referrals** tab.\n2. Enter your UPI ID (e.g. yourname@okhdfc).\n3. Click **Verify**.\n4. Once verified, you can request withdrawals to that UPI ID.\n\nYour UPI ID is stored securely and only used for payouts.",
  },
  {
    keywords: ["admin", "approval", "approve", "admin withdrawal"],
    answer:
      "Admins can review and process withdrawal requests from all users. If you have admin access, an **Admin** tab appears in the sidebar where you can approve, mark as processing, or reject withdrawals. To become an admin, your user role must be set to \"admin\" in the database.",
  },
  {
    keywords: ["profile", "edit profile", "update profile", "headline", "university"],
    answer:
      "To edit your profile:\n1. Click your avatar/name in the sidebar.\n2. Update your name, headline, university, and graduation year.\n3. Click **Save**.\n\nYour profile powers your job matches and roadmap, so keep it up to date.",
  },
  {
    keywords: ["logout", "sign out", "log out", "exit"],
    answer:
      "To log out, click the **Log out** button at the bottom of the sidebar. You'll be returned to the login page and your session cookie will be cleared.",
  },
  {
    keywords: ["password", "forgot password", "reset password", "reset"],
    answer:
      "To reset your password:\n1. Go to the login page and click **Forgot password?**.\n2. Enter your email — a 6-digit reset code will be generated (shown in development).\n3. Enter the code and a new password.\n4. Log in with your new password.",
  },
  {
    keywords: ["notification", "notifications", "alerts"],
    answer:
      "Notifications appear in the bell icon at the top of the dashboard. You'll get notified about new job matches, referral milestones, withdrawal status changes, and admin updates.",
  },
  {
    keywords: ["hello", "hi", "hey", "help", "start"],
    answer:
      "Hi! I'm Pathfinder Guide, your career workspace assistant. I can help with:\n- Uploading your resume and extracting skills\n- Understanding your skill roadmap\n- Job matches and shortlisting\n- Practice room\n- Referral rewards and withdrawals\n- UPI verification\n- Profile editing\n\nWhat would you like help with?",
  },
];

function findFallbackAnswer(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const suggestion of FALLBACK_SUGGESTIONS) {
    if (suggestion.keywords.some(kw => lower.includes(kw))) {
      return suggestion.answer;
    }
  }
  return "I'm here to help with resumes, skill roadmaps, job matches, practice, referrals, withdrawals, UPI verification, and your profile. Could you tell me a bit more about what you need? For example: \"How do I upload my resume?\" or \"How do I withdraw my earnings?\"";
}

export function hasLlmKey(): boolean {
  return Boolean(ENV.llmApiKey);
}

export function getFallbackReply(messages: Message[]): string {
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const userText = lastUserMessage
    ? (typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : Array.isArray(lastUserMessage.content)
          ? lastUserMessage.content.map(p => (typeof p === "string" ? p : p.type === "text" ? p.text : "")).join(" ")
          : "")
    : "";
  return findFallbackAnswer(userText);
}

// -----------------------------------------------------------------------------
// Fallback resume skill extraction (no API key required)
// -----------------------------------------------------------------------------

const SKILL_DATABASE: { name: string; aliases: string[]; category: string }[] = [
  // Programming languages
  { name: "JavaScript", aliases: ["javascript", "js", "es6", "ecmascript"], category: "Programming" },
  { name: "TypeScript", aliases: ["typescript", "ts"], category: "Programming" },
  { name: "Python", aliases: ["python", "py"], category: "Programming" },
  { name: "Java", aliases: ["java"], category: "Programming" },
  { name: "C++", aliases: ["c++", "cpp", "c plus plus"], category: "Programming" },
  { name: "C", aliases: ["c language", "c programming", "ansi c"], category: "Programming" },
  { name: "C#", aliases: ["c#", "csharp", "c sharp"], category: "Programming" },
  { name: "Go", aliases: ["golang", "go lang"], category: "Programming" },
  { name: "Rust", aliases: ["rust"], category: "Programming" },
  { name: "Ruby", aliases: ["ruby", "rails"], category: "Programming" },
  { name: "PHP", aliases: ["php"], category: "Programming" },
  { name: "Swift", aliases: ["swift"], category: "Programming" },
  { name: "Kotlin", aliases: ["kotlin"], category: "Programming" },
  { name: "SQL", aliases: ["sql"], category: "Database" },
  // Frontend
  { name: "React", aliases: ["react", "reactjs", "react.js"], category: "Frontend" },
  { name: "Vue", aliases: ["vue", "vuejs", "vue.js"], category: "Frontend" },
  { name: "Angular", aliases: ["angular", "angularjs"], category: "Frontend" },
  { name: "Next.js", aliases: ["next.js", "nextjs", "next js"], category: "Frontend" },
  { name: "HTML", aliases: ["html", "html5"], category: "Frontend" },
  { name: "CSS", aliases: ["css", "css3"], category: "Frontend" },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"], category: "Frontend" },
  { name: "Sass", aliases: ["sass", "scss"], category: "Frontend" },
  { name: "Redux", aliases: ["redux"], category: "Frontend" },
  { name: "Bootstrap", aliases: ["bootstrap"], category: "Frontend" },
  // Backend
  { name: "Node.js", aliases: ["node.js", "nodejs", "node"], category: "Backend" },
  { name: "Express", aliases: ["express", "express.js"], category: "Backend" },
  { name: "Django", aliases: ["django"], category: "Backend" },
  { name: "Flask", aliases: ["flask"], category: "Backend" },
  { name: "Spring Boot", aliases: ["spring boot", "spring", "springboot"], category: "Backend" },
  { name: "FastAPI", aliases: ["fastapi", "fast api"], category: "Backend" },
  { name: "GraphQL", aliases: ["graphql"], category: "Backend" },
  { name: "REST API", aliases: ["rest api", "restful", "rest apis"], category: "Backend" },
  // Database
  { name: "MongoDB", aliases: ["mongodb", "mongo"], category: "Database" },
  { name: "PostgreSQL", aliases: ["postgresql", "postgres", "psql"], category: "Database" },
  { name: "MySQL", aliases: ["mysql"], category: "Database" },
  { name: "Redis", aliases: ["redis"], category: "Database" },
  { name: "Firebase", aliases: ["firebase", "firestore"], category: "Database" },
  { name: "Prisma", aliases: ["prisma"], category: "Database" },
  { name: "Mongoose", aliases: ["mongoose"], category: "Database" },
  // DevOps & Cloud
  { name: "Docker", aliases: ["docker"], category: "DevOps" },
  { name: "Kubernetes", aliases: ["kubernetes", "k8s"], category: "DevOps" },
  { name: "AWS", aliases: ["aws", "amazon web services"], category: "Cloud" },
  { name: "Azure", aliases: ["azure", "microsoft azure"], category: "Cloud" },
  { name: "Google Cloud", aliases: ["gcp", "google cloud", "google cloud platform"], category: "Cloud" },
  { name: "CI/CD", aliases: ["ci/cd", "ci cd", "continuous integration", "continuous deployment", "github actions", "jenkins"], category: "DevOps" },
  { name: "Linux", aliases: ["linux", "ubuntu", "debian"], category: "DevOps" },
  // Tools & Practices
  { name: "Git", aliases: ["git", "github", "gitlab"], category: "Tools" },
  { name: "Agile", aliases: ["agile", "scrum", "sprint"], category: "Practices" },
  { name: "Jira", aliases: ["jira"], category: "Tools" },
  { name: "Figma", aliases: ["figma"], category: "Tools" },
  // Data & ML
  { name: "Machine Learning", aliases: ["machine learning", "ml", "ml models"], category: "Data/ML" },
  { name: "Deep Learning", aliases: ["deep learning", "neural networks", "neural network"], category: "Data/ML" },
  { name: "TensorFlow", aliases: ["tensorflow"], category: "Data/ML" },
  { name: "PyTorch", aliases: ["pytorch"], category: "Data/ML" },
  { name: "Pandas", aliases: ["pandas"], category: "Data/ML" },
  { name: "NumPy", aliases: ["numpy"], category: "Data/ML" },
  { name: "Data Analysis", aliases: ["data analysis", "data analyst", "data analytics"], category: "Data/ML" },
  { name: "NLP", aliases: ["nlp", "natural language processing"], category: "Data/ML" },
  // Soft skills
  { name: "Leadership", aliases: ["leadership", "team lead", "team leader"], category: "Soft Skills" },
  { name: "Communication", aliases: ["communication", "communication skills"], category: "Soft Skills" },
  { name: "Problem Solving", aliases: ["problem solving", "problem-solving", "analytical"], category: "Soft Skills" },
  { name: "Teamwork", aliases: ["teamwork", "team work", "collaboration", "collaborative"], category: "Soft Skills" },
  { name: "Project Management", aliases: ["project management", "project manager", "pm"], category: "Soft Skills" },
];

function extractTextFromPdf(buffer: Buffer): string {
  try {
    // pdf-parse is CommonJS
    const pdfParse = require("pdf-parse");
    // pdf-parse is synchronous-ish but returns a promise; we handle both.
    // We'll use a sync fallback: extract readable ASCII text from the buffer.
    // This is a simple heuristic that works for many text-based PDFs.
    const text = buffer.toString("latin1");
    // Extract text between parentheses in PDF content streams (Tj/TJ operators)
    const matches = text.match(/\(([^()]{2,})\)/g) || [];
    const extracted = matches
      .map(m => m.slice(1, -1))
      .filter(s => /[a-zA-Z]{2,}/.test(s))
      .join(" ");
    return extracted || text.replace(/[^\x20-\x7E]/g, " ");
  } catch {
    return buffer.toString("utf8").replace(/[^\x20-\x7E]/g, " ");
  }
}

async function extractTextFromPdfAsync(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch {
    return extractTextFromPdf(buffer);
  }
}

function extractSkillsFromText(text: string): { name: string; level: number; evidence: string }[] {
  const lower = text.toLowerCase();
  const found = new Map<string, { name: string; level: number; evidence: string }>();

  for (const skill of SKILL_DATABASE) {
    for (const alias of skill.aliases) {
      // Use lookaround boundaries to avoid false positives (e.g. "java" inside
      // "javascript") while still matching non-word aliases like "c++" and "c#".
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
      const match = lower.match(pattern);
      if (match) {
        // Find context around the match for evidence.
        const idx = match.index ?? 0;
        const start = Math.max(0, idx - 40);
        const end = Math.min(lower.length, idx + alias.length + 40);
        const context = text.slice(start, end).trim().replace(/\s+/g, " ");

        // Estimate proficiency: more mentions = higher level.
        const occurrences = (lower.match(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
        let level: number;
        if (occurrences >= 4) level = 85;
        else if (occurrences >= 2) level = 70;
        else level = 50;

        if (!found.has(skill.name) || found.get(skill.name)!.level < level) {
          found.set(skill.name, {
            name: skill.name,
            level,
            evidence: context.slice(0, 120),
          });
        }
        break; // Don't double-count aliases of the same skill.
      }
    }
  }

  return Array.from(found.values()).sort((a, b) => b.level - a.level);
}

function buildSummary(skills: { name: string; level: number }[], text: string): string {
  if (skills.length === 0) {
    return "No specific technical skills were detected in this resume. Try uploading a text-based PDF with clearly listed skills, technologies, and tools.";
  }
  const top = skills.slice(0, 5).map(s => s.name).join(", ");
  const categories = new Set(
    skills.map(s => SKILL_DATABASE.find(db => db.name === s.name)?.category).filter(Boolean),
  );
  return `Detected ${skills.length} skill${skills.length > 1 ? "s" : ""} including ${top}. The resume covers ${Array.from(categories).join(", ")}. Upload a more detailed resume for deeper analysis.`;
}

export type FallbackResumeResult = {
  skills: { name: string; level: number; evidence: string }[];
  summary: string;
  reviewNotes: string;
};

export async function getFallbackResumeExtraction(fileBuffer: Buffer, mimeType: string): Promise<FallbackResumeResult> {
  let text: string;
  if (mimeType === "application/pdf") {
    text = await extractTextFromPdfAsync(fileBuffer);
  } else {
    // For DOC/DOCX, extract whatever readable text we can.
    text = fileBuffer.toString("utf8").replace(/[^\x20-\x7E]/g, " ");
  }

  const skills = extractSkillsFromText(text);
  const summary = buildSummary(skills, text);
  const reviewNotes = skills.length > 0
    ? `Found ${skills.length} skill${skills.length > 1 ? "s" : ""}. Proficiency levels are estimated from mention frequency — adjust them based on your actual experience. This is a basic extraction without AI; add an OPENAI_API_KEY for deeper analysis.`
    : "No skills were detected. This could be because the PDF is image-based (scanned) or uses unusual formatting. Try uploading a text-based PDF, or add an OPENAI_API_KEY for AI-powered extraction.";

  return { skills, summary, reviewNotes };
}
