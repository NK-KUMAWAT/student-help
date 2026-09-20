import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  Flame,
  Gauge,
  ShieldCheck,
  Target,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { useAuth } from "../hooks/useAuth";
import { useAppData, type Skill } from "../state/AppData";
import type { RootStackParamList } from "../navigation/types";
import { AppHeader } from "../components/AppHeader";
import { ProgressRing } from "../components/ProgressRing";
import { SkillRow } from "../components/SkillRow";
import { AppButton, EmptyState, Panel, Screen, SectionHeading } from "../components/ui";
import { colors, radius, spacing } from "../theme";

type Move = { id: number; label: string; detail: string; tag: string; icon: React.ComponentType<{ size?: number; color?: string }> };

export default function OverviewScreen() {
  const { user } = useAuth();
  const {
    skills,
    extraction,
    completedMoves,
    toggleMove,
    resumeLoading,
    refetchResume,
  } = useAppData();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const displayName = user?.name || "Student";
  const firstName = displayName.split(" ")[0];
  const timeGreeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const profileCompletion = extraction ? Math.min(100, 62 + skills.length * 6) : 0;
  const skillScore =
    extraction && skills.length > 0
      ? (skills.reduce((sum, s) => sum + s.level, 0) / skills.length / 20).toFixed(1)
      : "0.0";

  const moves = useMemo((): Move[] => {
    if (!extraction || skills.length === 0) return [];
    const weakestSkill = [...skills].sort((a, b) => a.level - b.level)[0];
    return [
      {
        id: 1,
        label: `Improve your ${weakestSkill?.name ?? "weakest"} skill`,
        detail: `Your ${weakestSkill?.name ?? "skill"} is at ${weakestSkill?.level ?? 0}%. Raising it to 70% unlocks more roles.`,
        tag: "30 min",
        icon: Code2,
      },
      {
        id: 2,
        label: extraction.projects.length > 0 ? "Update your project details" : "Add a project to your profile",
        detail: extraction.projects.length > 0
          ? `You have ${extraction.projects.length} project${extraction.projects.length > 1 ? "s" : ""} from your resume. Add details to strengthen your profile.`
          : "No projects found in your resume. Add a project to prove you can deliver.",
        tag: "45 min",
        icon: FileText,
      },
      {
        id: 3,
        label: extraction.certifications.length > 0 ? "Review your certifications" : "Earn a certification",
        detail: extraction.certifications.length > 0
          ? `You have ${extraction.certifications.length} certification${extraction.certifications.length > 1 ? "s" : ""}. Keep them updated on your profile.`
          : "No certifications found in your resume. Earning one can boost your profile.",
        tag: "35 min",
        icon: Gauge,
      },
    ];
  }, [extraction, skills]);

  const goToMove = (id: number) => {
    if (id === 1) navigation.navigate("Main", { screen: "Roadmap" });
    else if (id === 2) navigation.navigate("Main", { screen: "Profile" });
    else navigation.navigate("Practice");
  };

  const resumeSections = extraction
    ? extraction.education.length + extraction.experience.length + extraction.projects.length + extraction.certifications.length
    : 0;

  return (
    <Screen
      refreshing={resumeLoading}
      onRefresh={refetchResume}
      contentStyle={styles.content}
    >
      <AppHeader title="Overview" />

      {/* Welcome */}
      <Text style={styles.h1}>
        {timeGreeting}, {firstName}
        <Text style={{ color: colors.orange }}>.</Text>
      </Text>
      <View style={styles.dateRow}>
        <Clock3 size={13} color={colors.textMuted} />
        <Text style={styles.dateText}>
          {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
          {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>

      {/* Hero card */}
      <View style={styles.hero}>
        <View style={styles.heroKicker}>
          <Text style={styles.heroKickerText}>THIS WEEK'S FOCUS</Text>
        </View>
        <Text style={styles.heroTitle}>Turn your skill graph{"\n"}into your next offer.</Text>
        <Text style={styles.heroCopy}>Build the one skill that unlocks the most roles, then prove it with a project.</Text>
        <View style={styles.heroRow}>
          <AppButton
            label="View my roadmap"
            variant="dark"
            onPress={() => navigation.navigate("Main", { screen: "Roadmap" })}
            icon={<ChevronRight size={15} color={colors.primaryForeground} />}
          />
          <View style={styles.heroScore}>
            <Text style={styles.heroScoreValue}>{extraction ? skillScore : "—"}</Text>
            <Text style={styles.heroScoreLabel}>{extraction ? "skill score" : "upload resume"}</Text>
          </View>
        </View>
      </View>

      {/* Metric cards */}
      <View style={styles.metricRow}>
        <View style={[styles.metric, styles.metricAccent]}>
          <View style={styles.metricLabel}>
            <Text style={styles.metricLabelText}>Profile strength</Text>
            <Gauge size={15} color={colors.green} />
          </View>
          <Text style={styles.metricValue}>{profileCompletion}%</Text>
          <Text style={styles.metricFoot}>{extraction ? "Based on resume analysis" : "Upload resume to start"}</Text>
        </View>
        <View style={styles.metric}>
          <View style={styles.metricLabel}>
            <Text style={styles.metricLabelText}>Skills tracked</Text>
            <BriefcaseBusiness size={15} color={colors.green} />
          </View>
          <Text style={styles.metricValue}>{extraction ? skills.length : "0"}</Text>
          <Text style={styles.metricFoot}>{extraction ? "from your resume" : "Upload resume"}</Text>
        </View>
        <View style={styles.metric}>
          <View style={styles.metricLabel}>
            <Text style={styles.metricLabelText}>Resume sections</Text>
            <FileText size={15} color={colors.green} />
          </View>
          <Text style={styles.metricValue}>{extraction ? resumeSections : "0"}</Text>
          <Text style={styles.metricFoot}>{extraction ? "edu, exp, projects, certs" : "No data yet"}</Text>
        </View>
      </View>

      {/* Next best moves */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="RECOMMENDED FOR YOU" title="Your next best moves" />
        {extraction ? (
          moves.map(move => {
            const complete = completedMoves.includes(move.id);
            const Icon = move.icon;
            return (
              <View key={move.id} style={[styles.moveRow, complete && styles.moveRowDone]}>
                <TouchableOpacity
                  style={[styles.checkButton, complete && styles.checkButtonDone]}
                  onPress={() => toggleMove(move.id)}
                  accessibilityLabel={complete ? `Mark ${move.label} incomplete` : `Mark ${move.label} complete`}
                >
                  {complete ? <Check size={13} color={colors.primaryForeground} /> : null}
                </TouchableOpacity>
                <View style={styles.moveIcon}>
                  <Icon size={16} color={colors.green} />
                </View>
                <View style={styles.moveCopy}>
                  <Text style={[styles.moveLabel, complete && styles.moveLabelDone]} numberOfLines={2}>
                    {move.label}
                  </Text>
                  <Text style={styles.moveDetail} numberOfLines={3}>
                    {move.detail}
                  </Text>
                </View>
                <View style={styles.moveRight}>
                  <Text style={styles.moveTag}>{move.tag}</Text>
                  <TouchableOpacity onPress={() => goToMove(move.id)} hitSlop={8} accessibilityLabel={`Open ${move.label}`}>
                    <ChevronRight size={17} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            title="No recommendations yet"
            body="Upload your resume to unlock personalized next moves."
          />
        )}
      </Panel>

      {/* Readiness snapshot */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="READINESS SNAPSHOT" title="Your profile at a glance" />
        <View style={styles.scoreLayout}>
          <ProgressRing value={profileCompletion} size={96} />
          <View style={styles.scoreCopy}>
            <Text style={styles.scoreTitle}>{extraction ? `Looking good, ${firstName}.` : "Let's get started."}</Text>
            <Text style={styles.scoreText}>
              {extraction
                ? `${skills.length} skills, ${extraction.education.length} education entries, ${extraction.projects.length} projects found.`
                : "Upload your resume to unlock your readiness snapshot and recommendations."}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Profile" })}>
              <Text style={styles.scoreLink}>
                {extraction ? "Improve profile" : "Upload resume"} <ArrowUpRight size={12} color="#3f8069" />
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.scoreMeta}>
          <View>
            <Text style={styles.scoreMetaLabel}>Projects</Text>
            <Text style={styles.scoreMetaValue}>
              {extraction ? extraction.projects.length : 0} <Text style={styles.scoreMetaSmall}>from resume</Text>
            </Text>
          </View>
          <View>
            <Text style={styles.scoreMetaLabel}>Core skills</Text>
            <Text style={styles.scoreMetaValue}>
              {extraction ? skills.length : 0} <Text style={styles.scoreMetaSmall}>tracked</Text>
            </Text>
          </View>
        </View>
      </Panel>

      {/* Skills */}
      <Panel style={styles.panelGap}>
        <SectionHeading
          eyebrow="SKILL VELOCITY"
          title="What's moving your score"
          action="Manage skills"
          onAction={() => navigation.navigate("Main", { screen: "Profile" })}
        />
        {extraction ? (
          skills.slice(0, 4).map((skill: Skill) => <SkillRow key={skill.name} skill={skill} />)
        ) : (
          <EmptyState
            title="No skills tracked yet"
            body="Upload your resume to extract your skills and see what's moving your score."
          />
        )}
      </Panel>

      {/* Resume pulse */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="MARKET PULSE" title="Your resume at a glance" />
        {extraction ? (
          <>
            <View style={styles.pulseMain}>
              <Text style={styles.pulseNumber}>
                {skills.length}
                <Text style={styles.pulseNumberSmall}> skills</Text>
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pulseTitle}>From your resume</Text>
                <Text style={styles.pulseText}>
                  {extraction.education.length} education · {extraction.experience.length} experience ·{" "}
                  {extraction.projects.length} projects
                </Text>
              </View>
            </View>
            <View style={styles.pulseFooter}>
              <View style={styles.pulseDot} />
              <Text style={styles.pulseFooterText} numberOfLines={1}>
                {extraction.personalDetails?.name || "Your profile"}
              </Text>
              <Text style={styles.pulseFooterMuted}>{extraction.certifications.length} certifications</Text>
            </View>
          </>
        ) : (
          <EmptyState
            title="Market pulse locked"
            body="Upload your resume to see your profile summary and resume sections."
          />
        )}
      </Panel>

      {/* Quick actions */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="QUICK ACTIONS" title="Jump back in" />
        <View style={styles.quickGrid}>
          <QuickAction
            icon={<Code2 size={18} color={colors.green} />}
            label="Practice room"
            onPress={() => navigation.navigate("Practice")}
          />
          <QuickAction
            icon={<Target size={18} color={colors.pink} />}
            label="Skill roadmap"
            onPress={() => navigation.navigate("Main", { screen: "Roadmap" })}
          />
          {user?.role === "admin" ? (
            <QuickAction
              icon={<ShieldCheck size={18} color={colors.orange} />}
              label="Admin withdrawals"
              onPress={() => navigation.navigate("AdminWithdrawals")}
            />
          ) : (
            <QuickAction
              icon={<Flame size={18} color={colors.amber} />}
              label="Help center"
              onPress={() => navigation.navigate("HelpCenter")}
            />
          )}
        </View>
        {user?.role === "admin" ? (
          <TouchableOpacity style={styles.helpLink} onPress={() => navigation.navigate("HelpCenter")}>
            <Text style={styles.helpLinkText}>Open Help Center</Text>
            <ChevronRight size={14} color={colors.green} />
          </TouchableOpacity>
        ) : null}
      </Panel>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  h1: { fontSize: 28, fontWeight: "800", color: colors.heading, letterSpacing: -1, marginBottom: 8 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dateText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },

  hero: {
    backgroundColor: colors.heroBg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  heroKicker: { marginBottom: 14 },
  heroKickerText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: "#569b7e" },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.primary, letterSpacing: -0.8, lineHeight: 28, marginBottom: 8 },
  heroCopy: { fontSize: 12, color: "#538371", lineHeight: 19, marginBottom: 18 },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroScore: {
    width: 78,
    height: 78,
    borderRadius: 99,
    backgroundColor: "#1c8261",
    alignItems: "center",
    justifyContent: "center",
  },
  heroScoreValue: { fontSize: 18, fontWeight: "800", color: "#ecfff4" },
  heroScoreLabel: { fontSize: 7, fontWeight: "700", color: "#bfe6d2", textTransform: "uppercase", letterSpacing: 0.8 },

  metricRow: { flexDirection: "row", gap: 10, marginTop: spacing.sm },
  metric: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  metricAccent: { backgroundColor: "#eef8f2", borderColor: "#cdeadb" },
  metricLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  metricLabelText: { fontSize: 9, fontWeight: "700", color: colors.textMuted },
  metricValue: { fontSize: 20, fontWeight: "800", color: colors.heading },
  metricFoot: { fontSize: 8, color: colors.textSubtle, marginTop: 4 },

  panelGap: { marginTop: spacing.md },
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f3f1",
  },
  moveRowDone: { opacity: 0.6 },
  checkButton: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#c9d8cf",
    alignItems: "center",
    justifyContent: "center",
  },
  checkButtonDone: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
  moveIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  moveCopy: { flex: 1, minWidth: 0 },
  moveLabel: { fontSize: 12, fontWeight: "800", color: colors.heading },
  moveLabelDone: { textDecorationLine: "line-through" },
  moveDetail: { fontSize: 10, color: colors.textMuted, marginTop: 3, lineHeight: 15 },
  moveRight: { alignItems: "flex-end", gap: 6 },
  moveTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6b7f76",
    backgroundColor: colors.muted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: "hidden",
  },

  scoreLayout: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  scoreCopy: { flex: 1, minWidth: 0 },
  scoreTitle: { fontSize: 13, fontWeight: "800", color: colors.heading, marginBottom: 5 },
  scoreText: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginBottom: 8 },
  scoreLink: { fontSize: 11, fontWeight: "800", color: "#3f8069" },
  scoreMeta: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scoreMetaLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 3 },
  scoreMetaValue: { fontSize: 15, fontWeight: "800", color: colors.heading },
  scoreMetaSmall: { fontSize: 9, fontWeight: "600", color: colors.textSubtle },

  pulseMain: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pulseNumber: { fontSize: 30, fontWeight: "800", color: colors.heading },
  pulseNumberSmall: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  pulseTitle: { fontSize: 12, fontWeight: "800", color: colors.heading },
  pulseText: { fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 16 },
  pulseFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: colors.mintDot },
  pulseFooterText: { flex: 1, fontSize: 11, fontWeight: "700", color: "#3c594b" },
  pulseFooterMuted: { fontSize: 10, color: colors.textMuted },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#f7fbf8",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 10,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12, fontWeight: "800", color: colors.heading },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  helpLinkText: { fontSize: 11, fontWeight: "800", color: colors.green },
});
