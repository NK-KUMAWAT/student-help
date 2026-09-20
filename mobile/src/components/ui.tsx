import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "../theme";

// -----------------------------------------------------------------------------
// Layout primitives
// -----------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ["top"],
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primarySoft} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

// -----------------------------------------------------------------------------
// Text primitives
// -----------------------------------------------------------------------------

export function Eyebrow({
  children,
  green,
  style,
}: {
  children: React.ReactNode;
  green?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.eyebrow, green && { color: colors.green }, style]}>{children}</Text>;
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action} →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Buttons
// -----------------------------------------------------------------------------

type ButtonVariant = "primary" | "dark" | "quiet" | "danger";

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
  small,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        styles[`button_${variant}`],
        small && styles.buttonSmall,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "quiet" ? colors.primary : colors.primaryForeground} />
      ) : (
        icon
      )}
      <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`], small && styles.buttonLabelSmall]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function IconButton({
  children,
  onPress,
  badge,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  badge?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.iconButton}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {children}
      {badge ? <View style={styles.iconBadge} /> : null}
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Form fields
// -----------------------------------------------------------------------------

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize = "sentences",
  autoComplete,
  right,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "name" | "off" | "one-time-code" | "password-new" | "username";
  right?: React.ReactNode;
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          maxLength={maxLength}
          multiline={multiline}
          style={[styles.fieldInput, multiline && { minHeight: 80, textAlignVertical: "top" }]}
        />
        {right ? <View style={styles.fieldRight}>{right}</View> : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Misc
// -----------------------------------------------------------------------------

export function Avatar({ name, size = 34, color }: { name: string; size?: number; color?: string }) {
  const initials = name
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: Math.round(size * 0.32) },
        color ? { backgroundColor: color } : null,
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials || "S"}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function StatusChip({ label, tone }: { label: string; tone: "green" | "blue" | "pink" | "amber" | "grey" }) {
  const map = {
    green: { bg: "#ddf4e9", fg: "#1c6b4c" },
    blue: { bg: "#e3edf7", fg: "#345f8c" },
    pink: { bg: "#f7e3ee", fg: "#9c4a72" },
    amber: { bg: "#f9ecd9", fg: "#9a6b2a" },
    grey: { bg: colors.muted, fg: colors.mutedForeground },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: map.bg }]}>
      <Text style={[styles.chipText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.greenBright, height = 6 }: { value: number; color?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }]}>
      <View style={[styles.progressFill, { width: `${clamped}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: Math.round(size * 0.3) }]}>
      <Image source={require("../../assets/img1.jpeg")} style={{ width: "100%", height: "100%", borderRadius: Math.round(size * 0.3) }} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },

  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },

  eyebrow: { ...typography.eyebrow, color: colors.textMuted, marginBottom: 8 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.heading, letterSpacing: -0.4 },
  sectionAction: { fontSize: 12, fontWeight: "800", color: "#3f8069" },

  button: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: spacing.md },
  button_primary: { backgroundColor: "#1a7055" },
  button_dark: { backgroundColor: "#173b35" },
  button_quiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  button_danger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: "#f0c8cb" },
  buttonDisabled: { opacity: 0.55 },
  buttonLabel: { fontSize: 13, fontWeight: "800" },
  buttonLabelSmall: { fontSize: 12 },
  buttonLabel_primary: { color: colors.primaryForeground },
  buttonLabel_dark: { color: colors.primaryForeground },
  buttonLabel_quiet: { color: colors.primary },
  buttonLabel_danger: { color: colors.danger },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.coral,
    borderWidth: 1,
    borderColor: colors.background,
  },

  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.heading, marginBottom: 6 },
  fieldInputWrap: { position: "relative", justifyContent: "center" },
  fieldInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingRight: 44,
    fontSize: 14,
    color: colors.foreground,
  },
  fieldRight: { position: "absolute", right: 6 },

  avatar: {
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.goldText, fontWeight: "800" },

  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: colors.heading, textAlign: "center" },
  emptyBody: { fontSize: 12, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 10, fontWeight: "800" },

  progressTrack: { backgroundColor: colors.trackBg, overflow: "hidden", width: "100%" },
  progressFill: { height: "100%" },

  brandMark: {
    backgroundColor: "#000",
    transform: [{ rotate: "-8deg" }],
    overflow: "hidden",
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
