import { ENV } from "./env";
import { PDFParse } from "pdf-parse";

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
    // Simple heuristic fallback: extract readable ASCII text from the buffer.
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
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    const data = await parser.getText();
    const text = typeof data === "string" ? data : (data.text || "");
    return text || "";
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
  rawText: string;
  education: { institution: string; degree: string; year: string; score: string }[];
  experience: { company: string; role: string; duration: string; description: string }[];
  projects: { title: string; description: string; technologies: string }[];
  certifications: { name: string; issuer: string; date: string }[];
  achievements: string[];
  languages: { name: string; proficiency: string }[];
  personalDetails: { name: string; email: string; phone: string; location: string; links: string[] };
};

// Extract education entries from resume text
function extractEducation(text: string): { institution: string; degree: string; year: string; score: string }[] {
  const education: { institution: string; degree: string; year: string; score: string }[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Look for education section
  const eduStart = lines.findIndex(l => /education/i.test(l));
  if (eduStart === -1) return education;

  // Find the next section header after education
  const nextSectionIdx = lines.findIndex((l, i) => i > eduStart && /^(experience|employment|work|internship|projects|skills|technical|certifications|achievements|training|languages|personal|declaration|summary|objective|contact)/i.test(l));
  const eduLines = nextSectionIdx === -1 ? lines.slice(eduStart + 1) : lines.slice(eduStart + 1, nextSectionIdx);

  // Parse education entries - look for patterns like "College Name, University" + "Degree Year" + "Score"
  let current: { institution: string; degree: string; year: string; score: string } | null = null;
  for (const line of eduLines) {
    const yearMatch = line.match(/(19|20)\d{2}[-–]?(19|20)?\d{0,2}/);
    const scoreMatch = line.match(/(\d{1,3}(\.\d+)?%|CGPA\s*:?\s*\d+(\.\d+)?)/i);
    const degreeMatch = line.match(/(bachelor|master|b\.?tech|m\.?tech|b\.?a\b|m\.?a\b|b\.?sc|m\.?sc|b\.?com|diploma|class\s+(x|xiix|xi)|senior secondary|secondary|higher secondary)/i);

    if (degreeMatch && !current) {
      current = { institution: "", degree: line, year: yearMatch ? yearMatch[0] : "", score: scoreMatch ? scoreMatch[0] : "" };
    } else if (current && !current.institution && !degreeMatch && !yearMatch && !scoreMatch) {
      current.institution = line;
    } else if (current && (yearMatch || scoreMatch) && !degreeMatch) {
      if (yearMatch && !current.year) current.year = yearMatch[0];
      if (scoreMatch && !current.score) current.score = scoreMatch[0];
    } else if (!current && !yearMatch && !scoreMatch && !degreeMatch) {
      // Could be institution name
      current = { institution: line, degree: "", year: "", score: "" };
    } else if (current && (current.institution || current.degree)) {
      if (yearMatch && !current.year) current.year = yearMatch[0];
      if (scoreMatch && !current.score) current.score = scoreMatch[0];
      if (!degreeMatch && !yearMatch && !scoreMatch && !current.institution) current.institution = line;
      else if (degreeMatch && !current.degree) current.degree = line;
    }
    // Push when we see a new degree or institution pattern
    if (current && current.degree && current.institution && (yearMatch || scoreMatch)) {
      education.push(current);
      current = null;
    }
  }
  // Push any remaining
  if (current && (current.institution || current.degree)) {
    education.push(current);
  }

  return education;
}

// Extract experience entries from resume text
function extractExperience(text: string): { company: string; role: string; duration: string; description: string }[] {
  const experience: { company: string; role: string; duration: string; description: string }[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const expStart = lines.findIndex(l => /^(experience|employment|work experience|internship)/i.test(l));
  if (expStart === -1) return experience;

  const nextSectionIdx = lines.findIndex((l, i) => i > expStart && /^(education|skills|technical|projects|certifications|achievements|training|languages|personal|declaration|summary|objective|contact)/i.test(l));
  const expLines = nextSectionIdx === -1 ? lines.slice(expStart + 1) : lines.slice(expStart + 1, nextSectionIdx);

  for (const line of expLines) {
    // Check if it mentions "fresher" or "no experience"
    if (/fresher|no experience|currently seeking/i.test(line)) {
      experience.push({ company: "", role: "Fresher", duration: "", description: line });
      continue;
    }
    // Try to parse company/role patterns
    const durationMatch = line.match(/((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(19|20)\d{2}\s*[-–to]+\s*(present|current|(19|20)\d{2})?/i);
    if (durationMatch) {
      experience.push({ company: "", role: "", duration: durationMatch[0], description: line });
    }
  }

  return experience;
}

// Extract projects from resume text
function extractProjects(text: string): { title: string; description: string; technologies: string }[] {
  const projects: { title: string; description: string; technologies: string }[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const projStart = lines.findIndex(l => /^projects?/i.test(l));
  if (projStart === -1) return projects;

  const nextSectionIdx = lines.findIndex((l, i) => i > projStart && /^(education|experience|skills|technical|certifications|achievements|training|languages|personal|declaration|summary|objective|contact|employment|work|internship)/i.test(l));
  const projLines = nextSectionIdx === -1 ? lines.slice(projStart + 1) : lines.slice(projStart + 1, nextSectionIdx);

  let current: { title: string; description: string; technologies: string } | null = null;
  for (const line of projLines) {
    // Project titles often start with a title-like pattern
    if (!current) {
      current = { title: line, description: "", technologies: "" };
    } else {
      current.description = current.description ? current.description + " " + line : line;
    }
  }
  if (current && current.title) {
    projects.push(current);
  }

  return projects;
}

// Extract certifications from resume text
function extractCertifications(text: string): { name: string; issuer: string; date: string }[] {
  const certifications: { name: string; issuer: string; date: string }[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const certStart = lines.findIndex(l => /^certifications?/i.test(l));
  if (certStart === -1) return certifications;

  const nextSectionIdx = lines.findIndex((l, i) => i > certStart && /^(education|experience|skills|technical|projects|achievements|training|languages|personal|declaration|summary|objective|contact|employment|work|internship)/i.test(l));
  const certLines = nextSectionIdx === -1 ? lines.slice(certStart + 1) : lines.slice(certStart + 1, nextSectionIdx);

  for (const line of certLines) {
    if (line.length > 3) {
      certifications.push({ name: line, issuer: "", date: "" });
    }
  }

  return certifications;
}

// Extract achievements from resume text
function extractAchievements(text: string): string[] {
  const achievements: string[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const achStart = lines.findIndex(l => /^achievements?|awards?|honors?/i.test(l));
  if (achStart === -1) return achievements;

  const nextSectionIdx = lines.findIndex((l, i) => i > achStart && /^(education|experience|skills|technical|projects|certifications|training|languages|personal|declaration|summary|objective|contact|employment|work|internship)/i.test(l));
  const achLines = nextSectionIdx === -1 ? lines.slice(achStart + 1) : lines.slice(achStart + 1, nextSectionIdx);

  for (const line of achLines) {
    if (line.length > 3) {
      achievements.push(line);
    }
  }

  return achievements;
}

// Extract languages from resume text
function extractLanguages(text: string): { name: string; proficiency: string }[] {
  const languages: { name: string; proficiency: string }[] = [];
  // Look for "Languages: Hindi, English" pattern
  const langMatch = text.match(/languages?\s*[:\-]?\s*([^\n|]+)/i);
  if (langMatch) {
    const langText = langMatch[1].replace(/^(hindi|english|spanish|french|german|sanskrit|telugu|tamil|kannada|bengali|marathi|gujarati|punjabi|urdu)\s*[,;]?\s*/i, "").trim();
    const found = langMatch[1].split(/[,;|]/).map(l => l.trim()).filter(Boolean);
    for (const lang of found) {
      const profMatch = lang.match(/\(([^)]+)\)/);
      languages.push({
        name: lang.replace(/\s*\([^)]*\)/, "").trim(),
        proficiency: profMatch ? profMatch[1] : "",
      });
    }
  }
  return languages;
}

// Extract personal details / contact info from resume text
function extractPersonalDetails(text: string): { name: string; email: string; phone: string; location: string; links: string[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Name is usually the first non-empty line
  const name = lines[0] || "";

  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const email = emailMatch ? emailMatch[0] : "";

  // Phone
  const phoneMatch = text.match(/(\+?\d[\d\s\-()]{8,})/);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  // Location
  const locMatch = text.match(/(?:location|address|city)\s*[:\-]?\s*([^\n|]+)/i);
  const location = locMatch ? locMatch[1].trim() : "";

  // Links
  const links: string[] = [];
  const linkedinMatch = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) links.push(linkedinMatch[0]);
  const githubMatch = text.match(/(https?:\/\/)?(www\.)?github\.com\/[\w-]+/i);
  if (githubMatch) links.push(githubMatch[0]);
  const portfolioMatch = text.match(/(https?:\/\/)?(www\.)?[\w.-]+\.[a-z]{2,}(\/\S*)?/i);
  if (portfolioMatch && !linkedinMatch && !githubMatch) links.push(portfolioMatch[0]);

  return { name, email, phone, location, links };
}

// Extract summary/objective from resume text
function extractSummarySection(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const summaryStart = lines.findIndex(l => /^(summary|objective|profile|about|career objective|professional summary)/i.test(l));
  if (summaryStart === -1) return "";

  const nextSectionIdx = lines.findIndex((l, i) => i > summaryStart && /^(education|experience|skills|technical|projects|certifications|achievements|training|languages|personal|declaration|contact|employment|work|internship)/i.test(l));
  const summaryLines = nextSectionIdx === -1 ? lines.slice(summaryStart + 1) : lines.slice(summaryStart + 1, nextSectionIdx);
  return summaryLines.join(" ");
}

export async function getFallbackResumeExtraction(fileBuffer: Buffer, mimeType: string): Promise<FallbackResumeResult> {
  let text: string;
  if (mimeType === "application/pdf") {
    text = await extractTextFromPdfAsync(fileBuffer);
  } else {
    // For DOC/DOCX, extract whatever readable text we can.
    text = fileBuffer.toString("utf8").replace(/[^\x20-\x7E]/g, " ");
  }

  const skills = extractSkillsFromText(text);
  const extractedSummary = extractSummarySection(text);
  const summary = extractedSummary || buildSummary(skills, text);
  const reviewNotes = skills.length > 0
    ? `Found ${skills.length} skill${skills.length > 1 ? "s" : ""}. Proficiency levels are estimated from mention frequency — adjust them based on your actual experience. This is a basic extraction without AI; add an OPENAI_API_KEY for deeper analysis.`
    : "No skills were detected. This could be because the PDF is image-based (scanned) or uses unusual formatting. Try uploading a text-based PDF, or add an OPENAI_API_KEY for AI-powered extraction.";

  const education = extractEducation(text);
  const experience = extractExperience(text);
  const projects = extractProjects(text);
  const certifications = extractCertifications(text);
  const achievements = extractAchievements(text);
  const languages = extractLanguages(text);
  const personalDetails = extractPersonalDetails(text);

  return { skills, summary, reviewNotes, rawText: text, education, experience, projects, certifications, achievements, languages, personalDetails };
}
