// Brand palette ported from client/src/index.css
export const colors = {
  background: "#f7f9f6",
  foreground: "#17252a",
  card: "#ffffff",
  primary: "#174d40",
  primarySoft: "#1a7055",
  primaryForeground: "#f5fff9",
  secondary: "#eaf1ec",
  muted: "#edf2ee",
  mutedForeground: "#71817b",
  accent: "#ddf4e9",
  accentForeground: "#174d40",
  destructive: "#be4b55",
  border: "#e2eae5",
  ring: "#5da98a",
  sidebar: "#132a27",
  heroBg: "#dff5e8",
  heading: "#192a2e",
  green: "#318064",
  greenBright: "#1c8261",
  mintDot: "#56a77c",
  trackBg: "#dcebe4",
  amber: "#e5ad5f",
  orange: "#e28c65",
  coral: "#db7d69",
  gold: "#f6c38c",
  goldText: "#5c3d22",
  blue: "#4a7fb5",
  pink: "#c4698f",
  chipGreen: "#c2f2d5",
  danger: "#be4b55",
  dangerSoft: "#fbe9ea",
  textMuted: "#81948a",
  textSubtle: "#9aa9a3",
};

export const skillTones = ["mint", "blue", "amber", "pink"] as const;
export type SkillTone = (typeof skillTones)[number];

export const toneColors: Record<SkillTone, string> = {
  mint: "#56a77c",
  blue: "#4a7fb5",
  amber: "#e5ad5f",
  pink: "#c4698f",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const typography = {
  eyebrow: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.3,
    textTransform: "uppercase" as const,
  },
};
