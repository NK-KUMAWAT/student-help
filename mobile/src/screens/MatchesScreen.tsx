import { BriefcaseBusiness, Plus, Search } from "lucide-react-native";
import React, { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { AppHeader } from "../components/AppHeader";
import { LockedState } from "../components/LockedState";
import { AppButton, EmptyState, Eyebrow, Panel, Screen } from "../components/ui";
import { useAppData, type Skill } from "../state/AppData";
import { colors, radius, spacing } from "../theme";

export default function MatchesScreen() {
  const { extraction, skills } = useAppData();
  const [search, setSearch] = useState("");

  const filtered = skills.filter(skill =>
    skill.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <AppHeader title="Job matches" />
      <Eyebrow green>JOB MATCHES</Eyebrow>
      <Text style={styles.h1}>Roles that fit your signal.</Text>
      <Text style={styles.copy}>
        {extraction ? `Based on ${skills.length} skills extracted from your resume.` : "Ranked by your current skills, interests and the gaps you can close."}
      </Text>

      {!extraction ? (
        <Panel>
          <LockedState
            icon={<BriefcaseBusiness size={28} color={colors.green} />}
            title="Upload your resume to see job matches"
            body="Job matches are ranked by how well your extracted skills align with each role. Upload a resume to get started."
          />
        </Panel>
      ) : (
        <>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search your skills"
                placeholderTextColor={colors.textSubtle}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.toolbarCount}>{skills.length} skills</Text>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item.name}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState
                icon={<Search size={20} color={colors.textMuted} />}
                title="No skills found"
                body="Upload a resume to extract your skills."
              />
            }
            renderItem={({ item }) => <SkillMatchCard skill={item} />}
          />
        </>
      )}
    </Screen>
  );
}

function SkillMatchCard({ skill }: { skill: Skill }) {
  const levelLabel = skill.level >= 70 ? "Advanced" : skill.level >= 50 ? "Intermediate" : "Beginner";
  return (
    <View style={styles.card}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>{skill.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardCompany} numberOfLines={1}>{skill.name}</Text>
        <Text style={styles.cardRole}>{levelLabel}</Text>
        <Text style={styles.cardMeta}>Proficiency: {skill.level}%</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.matchScore}>{skill.level}%</Text>
        <Text style={styles.matchLabel}>level</Text>
        <AppButton
          label="Practice"
          variant="dark"
          small
          icon={<Plus size={13} color={colors.primaryForeground} />}
          onPress={() => Toast.show({ type: "success", text1: `${skill.name} shortlisted for practice.` })}
          style={styles.practiceButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  h1: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.8, marginBottom: 6 },
  copy: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.lg },

  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.foreground, padding: 0 },
  toolbarCount: { fontSize: 10, fontWeight: "700", color: colors.textMuted },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 16, fontWeight: "800", color: colors.primary },
  cardCopy: { flex: 1, minWidth: 0 },
  cardCompany: { fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  cardRole: { fontSize: 13, fontWeight: "800", color: colors.heading, marginTop: 2 },
  cardMeta: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: "flex-end" },
  matchScore: { fontSize: 15, fontWeight: "800", color: colors.heading },
  matchLabel: { fontSize: 8, color: colors.textSubtle, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  practiceButton: { minHeight: 32 },
});
