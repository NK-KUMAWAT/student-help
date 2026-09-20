import { BarChart3, BookOpen, ChevronRight, Code2, FileText, Flame, Gauge, GraduationCap, Target } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { AppHeader } from "../components/AppHeader";
import { LockedState } from "../components/LockedState";
import { AppButton, Eyebrow, Panel, Screen } from "../components/ui";
import { buildPracticeRecommendations, type PracticeCategory } from "../lib/practice";
import { useAppData } from "../state/AppData";
import { colors, radius, spacing } from "../theme";

const categoryIcon: Record<PracticeCategory, { Icon: typeof Code2; color: string }> = {
  "Coding Practice": { Icon: Code2, color: colors.green },
  "Technical Questions": { Icon: BookOpen, color: colors.blue },
  "Interview Questions": { Icon: GraduationCap, color: colors.pink },
  "Aptitude / Problem Solving": { Icon: BarChart3, color: colors.blue },
  "Resume-based Questions": { Icon: FileText, color: colors.pink },
};

export default function PracticeScreen() {
  const { extraction, skills } = useAppData();
  const recommendations = extraction ? buildPracticeRecommendations(extraction, skills) : [];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Practice room" />
      <Eyebrow green>PRACTICE ROOM</Eyebrow>
      <Text style={styles.h1}>Practice with a point of view.</Text>
      <Text style={styles.copy}>Short, focused drills built from your resume analysis — weakest skills first.</Text>

      {!extraction ? (
        <Panel>
          <LockedState
            icon={<Code2 size={28} color={colors.green} />}
            title="Upload your resume to unlock practice drills"
            body="Practice drills are tailored to your current skill levels. Upload a resume to get started."
          />
        </Panel>
      ) : (
        <>
          <Eyebrow green style={styles.recommendedEyebrow}>RECOMMENDED</Eyebrow>
          <Text style={styles.recommendedTitle}>Drills matched to your resume analysis</Text>
          <View style={styles.grid}>
            {recommendations.map((rec, index) => {
              const { Icon, color } = categoryIcon[rec.category];
              const featured = index === 0;
              return (
                <View key={rec.id} style={[styles.card, featured && styles.cardFeatured]}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.label, !featured && styles.labelMuted]}>
                      {rec.category.toUpperCase()}{featured ? " · TOP PICK" : ""}
                    </Text>
                    <View style={styles.icon}><Icon size={18} color={color} /></View>
                  </View>
                  <Text style={styles.cardTitle}>{rec.title}</Text>
                  <Text style={styles.cardText}>{rec.description}</Text>
                  <View style={styles.skillTag}>
                    <Target size={11} color={colors.green} />
                    <Text style={styles.skillTagText}>{rec.skill}{rec.improvement ? " · focus area" : ""}</Text>
                  </View>
                  <View style={styles.meta}>
                    <View style={styles.metaItem}><BookOpen size={13} color={colors.textMuted} /><Text style={styles.metaText}>{rec.questions}</Text></View>
                    <View style={styles.metaItem}><Gauge size={13} color={colors.textMuted} /><Text style={styles.metaText}>{rec.difficulty}</Text></View>
                    <View style={styles.metaItem}><Flame size={13} color={colors.textMuted} /><Text style={styles.metaText}>{rec.minutes} min</Text></View>
                  </View>
                  <AppButton
                    label="Start practice"
                    variant={featured ? "dark" : "quiet"}
                    icon={<ChevronRight size={15} color={featured ? colors.primaryForeground : colors.primary} />}
                    onPress={() => Toast.show({ type: "success", text1: `${rec.title} started — timer ready in the next build.` })}
                  />
                </View>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  h1: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.8, marginBottom: 6 },
  copy: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.lg },
  recommendedEyebrow: { marginBottom: 4 },
  recommendedTitle: { fontSize: 15, fontWeight: "800", color: colors.heading, letterSpacing: -0.4, marginBottom: spacing.md },
  grid: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardFeatured: { backgroundColor: "#f2faf5", borderColor: "#cdeadb" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  label: { fontSize: 8, fontWeight: "800", letterSpacing: 1.3, color: colors.green },
  labelMuted: { color: colors.textMuted },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.heading, marginBottom: 6 },
  cardText: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  skillTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#eef7f1",
    marginBottom: spacing.md,
  },
  skillTagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6, color: colors.green, textTransform: "uppercase" },
  meta: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
});
