import { Check, ChevronRight, Target } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { LockedState } from "../components/LockedState";
import { Eyebrow, Panel, Screen, StatusChip } from "../components/ui";
import { useAppData } from "../state/AppData";
import { colors, radius, spacing } from "../theme";

export default function RoadmapScreen() {
  const { extraction, skills, completedMoves, toggleMove } = useAppData();

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Skill roadmap" />
      <Eyebrow green>SKILL ROADMAP</Eyebrow>
      <Text style={styles.h1}>A plan you can actually finish.</Text>
      <Text style={styles.copy}>Small, role-relevant sprints. No endless course playlists.</Text>

      {!extraction || skills.length === 0 ? (
        <Panel style={styles.lockedPanel}>
          <LockedState
            icon={<Target size={28} color={colors.green} />}
            title="Upload your resume to unlock your roadmap"
            body="Your personalized skill roadmap is built from the skills detected in your resume. Upload a resume to get started."
          />
        </Panel>
      ) : (
        <RoadmapContent />
      )}
    </Screen>
  );
}

function RoadmapContent() {
  const { extraction, skills, completedMoves, toggleMove } = useAppData();
  const weakest = [...skills].sort((a, b) => a.level - b.level)[0];
  const progressPercent = Math.round((completedMoves.length / 3) * 100);

  const steps = [
    {
      id: 1,
      week: "This week",
      title: `Improve ${weakest?.name ?? "your weakest skill"}`,
      text: `Raise ${weakest?.name ?? "this skill"} from ${weakest?.level ?? 0}% to 70%+ with focused practice`,
      status: completedMoves.includes(1) ? "Complete" : "In progress",
      tone: "green" as const,
    },
    {
      id: 2,
      week: "Next week",
      title: extraction!.projects.length > 0 ? "Update your project details" : "Ship one proof project",
      text: extraction!.projects.length > 0
        ? `You have ${extraction!.projects.length} project(s) from your resume — add details to strengthen your profile`
        : `Build a project using ${skills.slice(0, 2).map(s => s.name).join(" + ") || "your top skills"}`,
      status: completedMoves.includes(2) ? "Complete" : "Queued",
      tone: "blue" as const,
    },
    {
      id: 3,
      week: "Week 08",
      title: extraction!.certifications.length > 0 ? "Review your certifications" : "Practice the real screen",
      text: extraction!.certifications.length > 0
        ? `You have ${extraction!.certifications.length} certification(s) — keep them updated`
        : "Two timed interview practice rounds with feedback",
      status: completedMoves.includes(3) ? "Complete" : "Locked",
      tone: "pink" as const,
    },
  ];

  return (
    <>
      <View style={styles.banner}>
        <View style={styles.bannerNumber}>
          <Text style={styles.bannerNumberText}>01</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerEyebrow}>CURRENT MISSION</Text>
          <Text style={styles.bannerTitle}>Become interview-ready</Text>
          <Text style={styles.bannerSub}>Three focused sprints · {skills.length} skills tracked from your resume</Text>
        </View>
        <View style={styles.bannerProgress}>
          <Text style={styles.bannerProgressValue}>{progressPercent}%</Text>
          <Text style={styles.bannerProgressLabel}>complete</Text>
        </View>
      </View>

      <Panel style={{ marginTop: spacing.md }}>
        {steps.map((step, index) => {
          const done = step.status === "Complete";
          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.timeline}>
                <View style={[styles.timelineDot, styles[`dot_${step.tone}`], done && styles.timelineDotDone]}>
                  {done ? (
                    <Check size={12} color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.timelineIndex}>{index + 1}</Text>
                  )}
                </View>
                {index < steps.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepWeek}>{step.week.toUpperCase()}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
              <View style={styles.stepRight}>
                <StatusChip label={step.status} tone={done ? "green" : step.tone} />
                <TouchableOpacity onPress={() => toggleMove(step.id)} hitSlop={8} accessibilityLabel={`Toggle ${step.title}`}>
                  <ChevronRight size={17} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  h1: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.8, marginBottom: 6 },
  copy: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.lg },
  lockedPanel: { marginTop: spacing.sm },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.sidebar,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bannerNumber: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(194,242,213,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerNumberText: { color: "#c2f2d5", fontWeight: "800", fontSize: 15 },
  bannerEyebrow: { fontSize: 8, fontWeight: "800", letterSpacing: 1.4, color: "#8ac6a6", marginBottom: 4 },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: "#f0fbf5" },
  bannerSub: { fontSize: 10, color: "#86a49b", marginTop: 4, lineHeight: 14 },
  bannerProgress: { alignItems: "center" },
  bannerProgressValue: { fontSize: 17, fontWeight: "800", color: "#f0fbf5" },
  bannerProgressLabel: { fontSize: 8, color: "#86a49b", textTransform: "uppercase", letterSpacing: 0.8 },

  stepRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 12 },
  timeline: { alignItems: "center", width: 30 },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  dot_green: { borderColor: "#56a77c", backgroundColor: "#eef8f2" },
  dot_blue: { borderColor: "#4a7fb5", backgroundColor: "#eef3f9" },
  dot_pink: { borderColor: "#c4698f", backgroundColor: "#f9eef4" },
  timelineDotDone: { backgroundColor: "#1c8261", borderColor: "#1c8261" },
  timelineIndex: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
  timelineLine: { flex: 1, width: 2, backgroundColor: "#dcebe1", marginTop: 4, minHeight: 20 },
  stepCopy: { flex: 1, minWidth: 0 },
  stepWeek: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted, marginBottom: 3 },
  stepTitle: { fontSize: 13, fontWeight: "800", color: colors.heading, marginBottom: 4 },
  stepText: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  stepRight: { alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
});
