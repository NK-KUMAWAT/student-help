import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, LogIn, Mail, ShieldCheck, Sparkles, UserPlus, UserRound } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { authApi, queryKeys } from "../api";
import { AppButton, BrandMark, Field, Screen } from "../components/ui";
import { colors, radius, spacing } from "../theme";

type Mode = "login" | "register" | "forgot" | "reset";

function errorMessage(error: unknown, fallback: string): string {
  return (
    (error && typeof error === "object" && "response" in error
      ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
      : undefined) ||
    (error instanceof Error ? error.message : fallback)
  );
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const heading =
    mode === "login" ? "Welcome back"
    : mode === "register" ? "Start your placement journey today."
    : mode === "forgot" ? "Reset your password"
    : "Set a new password";

  const copy =
    mode === "login" ? "Log in to continue your placement journey."
    : mode === "register" ? "Save your skills, resume signal, roadmap, and role matches in one calm workspace."
    : mode === "forgot" ? "Enter your account email and we'll send a reset code."
    : "Choose a new password for your account.";

  const submitLabel =
    mode === "login" ? "Log in"
    : mode === "register" ? "Create account"
    : mode === "forgot" ? "Send reset code"
    : "Update password";

  const submitIcon =
    mode === "login" ? <LogIn size={16} color={colors.primaryForeground} />
    : mode === "register" ? <UserPlus size={16} color={colors.primaryForeground} />
    : mode === "forgot" ? <Mail size={16} color={colors.primaryForeground} />
    : <KeyRound size={16} color={colors.primaryForeground} />;

  const validate = (): string | null => {
    if (mode === "register" && name.trim().length < 2) return "Please enter your name";
    if ((mode === "forgot" || mode === "login" || mode === "register") && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return "Enter a valid email";
    if ((mode === "login" || mode === "register") && password.length < 6)
      return "Password must be at least 6 characters";
    if (mode === "reset" && (!/^[0-9]{6}$/.test(resetToken.trim()) || password.length < 6))
      return "Enter the 6-digit code and a password of at least 6 characters";
    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      Toast.show({ type: "error", text1: validationError });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") {
        const user = await authApi.register({ name: name.trim(), email: email.trim(), password });
        queryClient.setQueryData(queryKeys.authMe, user);
        Toast.show({ type: "success", text1: "Account created." });
      } else if (mode === "login") {
        const user = await authApi.login({ email: email.trim(), password });
        queryClient.setQueryData(queryKeys.authMe, user);
        Toast.show({ type: "success", text1: "Welcome back." });
      } else if (mode === "forgot") {
        const result = await authApi.forgotPassword({ email: email.trim() });
        if (result.resetCode) {
          setResetCode(result.resetCode);
          setMode("reset");
          Toast.show({ type: "success", text1: `Reset code generated: ${result.resetCode}` });
        } else {
          Toast.show({ type: "success", text1: "If that email exists, a reset code has been sent." });
        }
      } else {
        await authApi.resetPassword({ token: resetToken.trim(), password });
        Toast.show({ type: "success", text1: "Password updated. Please log in." });
        setMode("login");
        setPassword("");
        setResetToken("");
        setResetCode("");
      }
      // After login/register the authMe cache now holds the user, so the
      // navigator swaps to the main tabs automatically.
    } catch (error: unknown) {
      Toast.show({ type: "error", text1: errorMessage(error, "Something went wrong") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <BrandMark size={30} />
          <View>
            <Text style={styles.brandName}>student care help</Text>
            <Text style={styles.brandCaption}>support for every student</Text>
          </View>
        </View>

        <View style={styles.eyebrowRow}>
          <View style={styles.statusDot} />
          <Text style={styles.eyebrow}>YOUR CAREER WORKSPACE</Text>
        </View>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.copy}>{copy}</Text>

        {mode === "register" ? (
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoComplete="name"
          />
        ) : null}

        {mode === "reset" ? (
          <Field
            label="Reset code"
            value={resetToken}
            onChangeText={text => setResetToken(text.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder={resetCode ? `e.g. ${resetCode}` : "Enter 6-digit code"}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
          />
        ) : null}

        {mode === "forgot" || mode === "login" || mode === "register" ? (
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        ) : null}

        {mode === "login" || mode === "register" || mode === "reset" ? (
          <Field
            label={mode === "reset" ? "New password" : "Password"}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete={mode === "login" ? "password" : "password-new"}
            right={
              <TouchableOpacity
                onPress={() => setShowPassword(s => !s)}
                hitSlop={10}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                style={styles.eyeButton}
              >
                {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            }
          />
        ) : null}

        <AppButton
          label={submitting ? "Please wait…" : submitLabel}
          onPress={handleSubmit}
          loading={submitting}
          icon={submitIcon}
          style={styles.submit}
        />

        {mode === "login" ? (
          <TouchableOpacity onPress={() => { setMode("forgot"); setPassword(""); }} style={styles.forgot}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.switchLine}>
          {mode === "login" ? "New here? " : mode === "forgot" || mode === "reset" ? "Remembered it? " : "Already have an account? "}
          <Text
            style={styles.switchLink}
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setPassword("");
              setResetToken("");
            }}
          >
            {mode === "login" ? "Create an account" : mode === "forgot" || mode === "reset" ? "Back to log in" : "Log in instead"}
          </Text>
        </Text>

        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <ShieldCheck size={13} color={colors.green} />
            <Text style={styles.footerText}>Secure sign-in</Text>
          </View>
          <View style={styles.footerItem}>
            <UserRound size={13} color={colors.green} />
            <Text style={styles.footerText}>Personal profile</Text>
          </View>
          <View style={styles.footerItem}>
            <Sparkles size={13} color={colors.green} />
            <Text style={styles.footerText}>Clear next steps</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingVertical: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  brandName: { fontSize: 16, fontWeight: "800", color: colors.heading, letterSpacing: -0.5 },
  brandCaption: { fontSize: 9, fontWeight: "800", color: "#86a49b", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#4aa47c" },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.3, color: colors.green },
  heading: { fontSize: 26, fontWeight: "800", color: colors.heading, letterSpacing: -0.9, lineHeight: 32, marginBottom: 10 },
  copy: { fontSize: 13, color: colors.mutedForeground, lineHeight: 20, marginBottom: 22 },
  submit: { marginTop: 6 },
  eyeButton: { padding: 8 },
  forgot: { alignSelf: "center", marginTop: 14, padding: 4 },
  forgotText: { fontSize: 12, fontWeight: "700", color: "#3f8069" },
  switchLine: { textAlign: "center", marginTop: 18, fontSize: 12, color: colors.mutedForeground },
  switchLink: { color: "#3f8069", fontWeight: "800" },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
});
