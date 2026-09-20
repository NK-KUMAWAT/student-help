import type { ExtractedResume } from "../api/types";

export type PracticeCategory =
  | "Coding Practice"
  | "Technical Questions"
  | "Interview Questions"
  | "Aptitude / Problem Solving"
  | "Resume-based Questions";

export type PracticeDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type PracticeRecommendation = {
  id: string;
  category: PracticeCategory;
  title: string;
  description: string;
  skill: string;
  difficulty: PracticeDifficulty;
  questions: string;
  minutes: number;
  improvement: boolean;
};

type SkillInput = { name: string; level: number };

const CODING_LANGUAGE = /\b(python|java(script)?|typescript|node\.?js|c\+\+|c#|c|golang?|rust|php|ruby|swift|kotlin|scala|dart|matlab|perl|r)\b/i;
const DATABASE_SQL = /\b(sql|mysql|postgres(ql)?|pl\/?sql|t-?sql|sqlite|nosql|mongo(db)?|oracle|database|dbms|redis)\b/i;
const DATA_UMBRELLA = /(data\s*ana(lysis|lytics|lyst)|data\s*science|business\s*intelligence|\bbi\b)/i;
const DATA_TOOL = /(excel|power\s*bi|tableau|pandas|numpy|matplotlib|seaborn|statistics|data\s*visuali[sz]ation|looker)/i;
const WEB_UMBRELLA = /(front[- ]?end|web\s*dev(elopment)?|full[- ]?stack)/i;
const WEB_DEV = /(html|css|react|angular|vue|next\.?js|express|tailwind|redux|bootstrap|front[- ]?end|web\s*dev(elopment)?|full[- ]?stack|ui\/?ux)/i;
const ML_AI = /(machine\s*learning|deep\s*learning|\bnlp\b|tensorflow|pytorch|scikit(-learn)?|keras|artificial\s*intelligence|\bllm\b|computer\s*vision|neural)/i;
const SOFT_SKILL = /(communication|leadership|team ?work|collaboration|presentation|public\s*speaking|time\s*management|interpersonal)/i;

const IMPROVEMENT_THRESHOLD = 60;

const difficultyFor = (level: number): PracticeDifficulty =>
  level <= 45 ? "Beginner" : level <= 70 ? "Intermediate" : "Advanced";

function cardForSkill(skill: SkillInput, allSkillNames: string[]): Omit<PracticeRecommendation, "id"> {
  const { name, level } = skill;
  const difficulty = difficultyFor(level);
  const improvement = level < IMPROVEMENT_THRESHOLD;
  const focusNote = improvement ? ` Your analysis rates ${name} at ${level}%, so this is a focus area.` : "";

  if (DATA_UMBRELLA.test(name)) {
    const detectedTools = allSkillNames.filter(other => other !== name && (DATA_TOOL.test(other) || DATABASE_SQL.test(other)));
    const tools = detectedTools.length ? detectedTools.slice(0, 3).join(", ") : "Excel, SQL and Power BI";
    return {
      category: "Interview Questions",
      title: "Data analysis interview prep",
      description: `Practice ${tools} questions grounded in your ${name} background.${focusNote}`,
      skill: name,
      difficulty,
      questions: "10 questions",
      minutes: 25,
      improvement,
    };
  }
  if (DATA_TOOL.test(name)) {
    return {
      category: "Technical Questions",
      title: `${name} technical drill`,
      description: `Answer interview-style ${name} questions on formulas, models and reports.${focusNote}`,
      skill: name,
      difficulty,
      questions: "8 questions",
      minutes: 20,
      improvement,
    };
  }
  if (DATABASE_SQL.test(name)) {
    return {
      category: "Interview Questions",
      title: `${name} interview questions`,
      description: `Translate business questions into ${name} queries and explain the tradeoffs.${focusNote}`,
      skill: name,
      difficulty,
      questions: "8 questions",
      minutes: 20,
      improvement,
    };
  }
  if (/react/i.test(name)) {
    return {
      category: "Coding Practice",
      title: `${name} component screen`,
      description: `Build a filterable list in ${name} with accessible states and clean component boundaries.${focusNote}`,
      skill: name,
      difficulty,
      questions: "8 prompts",
      minutes: 35,
      improvement,
    };
  }
  if (WEB_UMBRELLA.test(name)) {
    const detectedStack = allSkillNames.filter(other => other !== name && WEB_DEV.test(other));
    const stack = detectedStack.length ? ` your ${detectedStack.slice(0, 3).join(", ")} stack` : " a small interface";
    return {
      category: "Coding Practice",
      title: `${name} build screen`,
      description: `Ship a page with${stack} and explain your markup and styling choices.${focusNote}`,
      skill: name,
      difficulty,
      questions: "6 prompts",
      minutes: 30,
      improvement,
    };
  }
  if (CODING_LANGUAGE.test(name)) {
    return {
      category: "Coding Practice",
      title: `${name} coding practice`,
      description: `Solve timed ${name} problems and review the patterns you missed.${focusNote}`,
      skill: name,
      difficulty,
      questions: "10 problems",
      minutes: 30,
      improvement,
    };
  }
  if (WEB_DEV.test(name)) {
    return {
      category: "Coding Practice",
      title: `${name} build screen`,
      description: `Ship a small feature with ${name} and explain your implementation choices.${focusNote}`,
      skill: name,
      difficulty,
      questions: "6 prompts",
      minutes: 30,
      improvement,
    };
  }
  if (ML_AI.test(name)) {
    return {
      category: "Technical Questions",
      title: `${name} concepts review`,
      description: `Defend the ${name} choices on your resume — data, metrics and tradeoffs.${focusNote}`,
      skill: name,
      difficulty,
      questions: "8 questions",
      minutes: 25,
      improvement,
    };
  }
  if (SOFT_SKILL.test(name)) {
    return {
      category: "Interview Questions",
      title: `${name} behavioral prep`,
      description: `Turn your ${name} evidence into clear STAR-format interview answers.${focusNote}`,
      skill: name,
      difficulty,
      questions: "6 questions",
      minutes: 15,
      improvement,
    };
  }
  return {
    category: "Technical Questions",
    title: `${name} fundamentals check`,
    description: `Drill the core ${name} concepts behind the evidence on your resume.${focusNote}`,
    skill: name,
    difficulty,
    questions: "10 questions",
    minutes: 20,
    improvement,
  };
}

function resumeBasedCards(extraction: ExtractedResume): Omit<PracticeRecommendation, "id">[] {
  const cards: Omit<PracticeRecommendation, "id">[] = [];
  const project = extraction.projects.find(item => item.title?.trim());
  if (project) {
    const tech = project.technologies?.split(/[,/+&]|\band\b/i).map(part => part.trim()).filter(Boolean)[0];
    cards.push({
      category: "Resume-based Questions",
      title: `Tell your ${project.title} story`,
      description: `Turn ${project.title} into a clear two-minute interview narrative — problem, approach, result.`,
      skill: tech || "Projects",
      difficulty: "Intermediate",
      questions: "5 prompts",
      minutes: 15,
      improvement: false,
    });
  }
  const experience = extraction.experience.find(item => item.role?.trim());
  if (experience) {
    cards.push({
      category: "Resume-based Questions",
      title: `Defend your ${experience.role} experience`,
      description: `Practice follow-ups on your ${experience.role} work${experience.company ? ` at ${experience.company}` : ""} — what you built, measured and learned.`,
      skill: experience.role,
      difficulty: "Intermediate",
      questions: "6 questions",
      minutes: 20,
      improvement: false,
    });
  }
  return cards;
}

/**
 * Builds personalized practice recommendations from the analyzed resume only —
 * detected skills (weakest first), projects, and experience. Nothing is invented:
 * every card is grounded in data returned by the resume analysis.
 */
export function buildPracticeRecommendations(
  extraction: ExtractedResume,
  skills: SkillInput[] = extraction.skills,
): PracticeRecommendation[] {
  const pool = skills.length ? skills : extraction.skills;
  const names = pool.map(skill => skill.name);
  const seen = new Set<string>();

  const skillCards: Omit<PracticeRecommendation, "id">[] = [];
  for (const skill of [...pool].sort((a, b) => a.level - b.level)) {
    const card = cardForSkill(skill, names);
    const key = card.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skillCards.push(card);
  }

  const resumeCards = resumeBasedCards(extraction).filter(card => {
    const key = card.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const aptitudeCard: Omit<PracticeRecommendation, "id"> = {
    category: "Aptitude / Problem Solving",
    title: "Quant & logic sprint",
    description: "Timed aptitude drills — percentages, ratios and logic puzzles asked in placement tests.",
    skill: "Problem solving",
    difficulty: "Intermediate",
    questions: "15 questions",
    minutes: 20,
    improvement: false,
  };

  return [
    ...skillCards.slice(0, 3),
    ...resumeCards.slice(0, 2),
    aptitudeCard,
    ...skillCards.slice(3, 5),
  ]
    .slice(0, 6)
    .map((card, index) => ({ ...card, id: `practice-${index}` }));
}
