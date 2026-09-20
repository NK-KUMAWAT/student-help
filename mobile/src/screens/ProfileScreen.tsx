import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Plus, Sparkles, Upload, UserRound, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { profileApi, queryKeys } from "../api";
import type { ExtractedResume } from "../api/types";
import { AppHeader } from "../components/AppHeader";
import { SkillRow } from "../components/SkillRow";
import { AppButton, Avatar, Eyebrow, Field, Panel, ProgressBar, Screen, SectionHeading } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../state/AppData";
import { colors, radius, spacing } from "../theme";

export default function ProfileScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    skills,
    extraction,
    isExtracting,
    isSavingEdits,
    uploadResume,
    addSkill,
    saveExtraction,
  } = useAppData();

  const displayName = user?.name || "Student";
  const [profile, setProfile] = useState({ name: "", headline: "", university: "", graduationYear: "" });

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || "",
      headline: user.headline || "",
      university: user.university || "",
      graduationYear: user.graduationYear ? String(user.graduationYear) : "",
    });
  }, [user?.id, user?.name, user?.headline, user?.university, user?.graduationYear]);

  const profileMutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: async updated => {
      queryClient.setQueryData(queryKeys.authMe, updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
      Toast.show({ type: "success", text1: "Your profile is saved." });
    },
    onError: (error: unknown) =>
      Toast.show({
        type: "error",
        text1: error instanceof Error ? error.message : "Could not save your profile.",
      }),
  });

  const handleSaveProfile = () => {
    const name = profile.name.trim() || user?.name?.trim() || "";
    if (name.length < 2) {
      Toast.show({ type: "error", text1: "Please enter your name before saving your profile." });
      return;
    }
    const graduationYear = profile.graduationYear.trim();
    profileMutation.mutate({
      name,
      headline: profile.headline.trim(),
      university: profile.university.trim(),
      graduationYear: graduationYear ? Number(graduationYear) : null,
    });
  };

  const hasResume = Boolean(extraction);
  // Suggested skills come from the backend skill database — empty until the
  // resume analysis produces them, same as the web app.
  const suggestedSkills: { name: string; level: number; tone: "mint" }[] = [];

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="My profile" />

      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Eyebrow green>YOUR PROFILE</Eyebrow>
          <Text style={styles.h1}>Make your signal clearer.</Text>
          <Text style={styles.copy}>Recruiters see your profile before they see your potential. Keep the signal sharp.</Text>
        </View>
      </View>
      <AppButton
        label={profileMutation.isPending ? "Saving…" : "Save changes"}
        onPress={handleSaveProfile}
        loading={profileMutation.isPending}
        icon={<Check size={15} color={colors.primaryForeground} />}
        style={styles.saveButton}
      />

      {/* Profile card */}
      <Panel style={styles.panelGap}>
        <View style={styles.profileTop}>
          <Avatar name={profile.name || displayName} size={58} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedText}>Profile visible to recruiters</Text>
            </View>
            <Text style={styles.profileName} numberOfLines={1}>{profile.name || displayName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || "Add an email through account sign-in"}</Text>
          </View>
        </View>

        <Field
          label="Full name"
          value={profile.name}
          onChangeText={text => setProfile(c => ({ ...c, name: text }))}
          placeholder="Your name"
          autoComplete="name"
        />
        <Field
          label="Headline"
          value={profile.headline}
          onChangeText={text => setProfile(c => ({ ...c, headline: text }))}
          placeholder={hasResume && extraction?.personalDetails?.name ? extraction.personalDetails.name : ""}
        />
        <Field
          label="University"
          value={profile.university}
          onChangeText={text => setProfile(c => ({ ...c, university: text }))}
          placeholder={hasResume && extraction?.education?.length ? extraction.education[0].institution : ""}
        />
        <Field
          label="Graduation year"
          value={profile.graduationYear}
          onChangeText={text => setProfile(c => ({ ...c, graduationYear: text.replace(/[^0-9]/g, "").slice(0, 4) }))}
          placeholder={hasResume && extraction?.education?.length ? extraction.education[0].year : ""}
          keyboardType="number-pad"
          maxLength={4}
        />

        {/* Resume upload */}
        <TouchableOpacity
          style={[styles.uploadCard, isExtracting && styles.uploadCardBusy]}
          onPress={uploadResume}
          disabled={isExtracting}
          activeOpacity={0.8}
        >
          <View style={styles.uploadIcon}>
            {isExtracting ? <Sparkles size={18} color={colors.green} /> : <Upload size={18} color={colors.green} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.uploadTitle}>
              {isExtracting ? "AI is reading your resume…" : extraction ? "Analyze another resume" : "Upload latest resume"}
            </Text>
            <Text style={styles.uploadSub} numberOfLines={1}>
              {isExtracting ? "Extracting skills and evidence" : extraction ? `${extraction.fileName} · analyzed` : "PDF, DOC or DOCX · up to 6 MB"}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Extraction summary */}
        {extraction ? (
          <View style={styles.extractionCard}>
            <View style={styles.extractionHeading}>
              <View style={{ flex: 1 }}>
                <Eyebrow green>AI RESUME READ</Eyebrow>
                <Text style={styles.extractionTitle}>{extraction.skills.length} skills found</Text>
              </View>
              <View style={styles.savedBadge}>
                <Check size={11} color="#1c6b4c" />
                <Text style={styles.savedBadgeText}>Saved</Text>
              </View>
            </View>
            {extraction.summary ? <Text style={styles.extractionSummary}>{extraction.summary}</Text> : null}
            <View style={styles.extractedGrid}>
              {extraction.skills.slice(0, 6).map(skill => (
                <View key={skill.name} style={styles.extractedSkill}>
                  <View style={styles.extractedSkillTop}>
                    <Text style={styles.extractedSkillName} numberOfLines={1}>{skill.name}</Text>
                    <Text style={styles.extractedSkillLevel}>{skill.level}% signal</Text>
                  </View>
                  <ProgressBar value={skill.level} color="#56a77c" height={4} />
                  {skill.evidence ? (
                    <Text style={styles.extractedSkillEvidence} numberOfLines={2}>{skill.evidence}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Panel>

      {/* Skill graph */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="YOUR SKILL GRAPH" title={`${skills.length} skills tracked`} />
        {extraction ? (
          <EditableExtraction extraction={extraction} isSaving={isSavingEdits} onSave={saveExtraction} />
        ) : null}
        {skills.map(skill => (
          <SkillRow key={skill.name} skill={skill} />
        ))}
        {hasResume && suggestedSkills.length > 0 ? (
          <View style={styles.suggestedBox}>
            <View style={styles.suggestedHeading}>
              <Sparkles size={15} color={colors.green} />
              <Text style={styles.suggestedTitle}>Suggested next</Text>
            </View>
            <Text style={styles.suggestedText}>These skills can raise your role match fastest.</Text>
            <View style={styles.suggestedChips}>
              {suggestedSkills.map(skill => (
                <TouchableOpacity key={skill.name} style={styles.suggestedChip} onPress={() => addSkill(skill)}>
                  <Plus size={12} color={colors.green} />
                  <Text style={styles.suggestedChipText}>{skill.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </Panel>
    </Screen>
  );
}

function EditableExtraction({
  extraction,
  isSaving,
  onSave,
}: {
  extraction: ExtractedResume;
  isSaving: boolean;
  onSave: (next: ExtractedResume) => void;
}) {
  const [draft, setDraft] = useState(extraction);

  useEffect(() => {
    setDraft(extraction);
  }, [extraction.resumeId]);

  const updateSkill = (index: number, patch: Partial<{ name: string; level: number }>) => {
    setDraft(d => ({
      ...d,
      skills: d.skills.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  return (
    <View style={editStyles.box}>
      <View style={editStyles.heading}>
        <Sparkles size={13} color={colors.green} />
        <Text style={editStyles.headingText}>SECOND AI REVIEW</Text>
        <Text style={editStyles.headingSub}>Review and edit before saving</Text>
      </View>
      {draft.skills.map((skill, index) => (
        <View key={`${skill.name}-${index}`} style={editStyles.row}>
          <TextInput
            value={skill.name}
            onChangeText={text => updateSkill(index, { name: text })}
            style={[editStyles.input, editStyles.nameInput]}
            placeholder="Skill"
            placeholderTextColor={colors.textSubtle}
          />
          <TextInput
            value={String(skill.level)}
            onChangeText={text => {
              const n = Number(text.replace(/[^0-9]/g, ""));
              updateSkill(index, { level: Number.isNaN(n) ? 1 : Math.min(100, Math.max(1, n)) });
            }}
            keyboardType="number-pad"
            style={[editStyles.input, editStyles.levelInput]}
            maxLength={3}
          />
          <TouchableOpacity
            onPress={() => setDraft(d => ({ ...d, skills: d.skills.filter((_, i) => i !== index) }))}
            hitSlop={8}
            accessibilityLabel={`Remove ${skill.name}`}
            style={editStyles.remove}
          >
            <X size={14} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={editStyles.addSkill}
        onPress={() =>
          setDraft(d => ({ ...d, skills: [...d.skills, { name: "New skill", level: 50, evidence: "Added by student" }] }))
        }
      >
        <Plus size={13} color="#3f8069" />
        <Text style={editStyles.addSkillText}>Add skill</Text>
      </TouchableOpacity>
      <AppButton
        label={isSaving ? "Saving…" : "Save reviewed skills"}
        variant="dark"
        small
        loading={isSaving}
        onPress={() => onSave(draft)}
        icon={<Check size={13} color={colors.primaryForeground} />}
        style={editStyles.save}
      />
    </View>
  );
}

const editStyles = StyleSheet.create({
  box: {
    backgroundColor: "#f7fbf8",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md, flexWrap: "wrap" },
  headingText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.1, color: colors.green },
  headingSub: { fontSize: 10, color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12,
    color: colors.foreground,
  },
  nameInput: { flex: 1 },
  levelInput: { width: 58, textAlign: "center" },
  remove: { padding: 6 },
  addSkill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8 },
  addSkillText: { fontSize: 11, fontWeight: "800", color: "#3f8069" },
  save: { alignSelf: "flex-start", marginTop: 4 },
});

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  headingRow: { flexDirection: "row", marginBottom: 4 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.8, marginBottom: 6 },
  copy: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18 },
  saveButton: { marginTop: spacing.sm, alignSelf: "flex-start" },
  panelGap: { marginTop: spacing.md },

  profileTop: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  verifiedDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#4aa47c" },
  verifiedText: { fontSize: 9, fontWeight: "700", color: colors.green, letterSpacing: 0.4 },
  profileName: { fontSize: 18, fontWeight: "800", color: colors.heading },
  profileEmail: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  uploadCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#b9d6c6",
    borderRadius: radius.md,
    backgroundColor: "#f4faf6",
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  uploadCardBusy: { opacity: 0.7 },
  uploadIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: { fontSize: 12, fontWeight: "800", color: colors.heading },
  uploadSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  extractionCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "#cdeadb",
    backgroundColor: "#f2faf5",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  extractionHeading: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  extractionTitle: { fontSize: 14, fontWeight: "800", color: colors.heading },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ddf4e9",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  savedBadgeText: { fontSize: 9, fontWeight: "800", color: "#1c6b4c" },
  extractionSummary: { fontSize: 11, color: "#538371", lineHeight: 17, marginBottom: spacing.md },
  extractedGrid: { gap: 10 },
  extractedSkill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    gap: 6,
  },
  extractedSkillTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  extractedSkillName: { fontSize: 11, fontWeight: "800", color: colors.heading, flex: 1 },
  extractedSkillLevel: { fontSize: 9, fontWeight: "700", color: colors.textMuted },
  extractedSkillEvidence: { fontSize: 9, color: colors.textSubtle, lineHeight: 13 },

  suggestedBox: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "#f7fbf8",
  },
  suggestedHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  suggestedTitle: { fontSize: 12, fontWeight: "800", color: colors.heading },
  suggestedText: { fontSize: 10, color: colors.textMuted, marginTop: 5, marginBottom: 10 },
  suggestedChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#b9d6c6",
    backgroundColor: colors.card,
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  suggestedChipText: { fontSize: 11, fontWeight: "700", color: colors.primary },
});
