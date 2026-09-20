import { LifeBuoy, Loader2, Send, Sparkles, User } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ChatMessage } from "../api/types";
import { Eyebrow } from "../components/ui";
import { useAppData } from "../state/AppData";
import { colors, radius, spacing } from "../theme";

export default function HelpCenterScreen() {
  const { chatMessages, sendHelpMessage, isChatLoading } = useAppData();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const displayMessages = chatMessages.filter(m => m.role !== "system");

  const send = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isChatLoading) return;
    sendHelpMessage(trimmed);
    setInput("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <LifeBuoy size={18} color={colors.primaryForeground} />
          </View>
          <View>
            <Eyebrow green style={{ marginBottom: 2 }}>HELP CENTER</Eyebrow>
            <Text style={styles.headerTitle}>Pathfinder Guide</Text>
            <Text style={styles.headerSub}>Always here for your next step</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={displayMessages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Sparkles size={40} color={colors.border} />
              <Text style={styles.emptyText}>What can I help you with?</Text>
              <View style={styles.suggested}>
                {["How do I upload my resume?", "What is my skill score?", "How do referrals work?"].map(prompt => (
                  <TouchableOpacity key={prompt} style={styles.suggestedChip} onPress={() => send(prompt)} disabled={isChatLoading}>
                    <Text style={styles.suggestedChipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.msgRow, item.role === "user" ? styles.msgRowUser : styles.msgRowAssistant]}>
              {item.role === "assistant" ? (
                <View style={styles.avatarAssistant}>
                  <Sparkles size={14} color={colors.primary} />
                </View>
              ) : null}
              <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
                {item.role === "assistant" ? (
                  <Markdown style={markdownStyles}>{item.content}</Markdown>
                ) : (
                  <Text style={styles.bubbleTextUser}>{item.content}</Text>
                )}
              </View>
              {item.role === "user" ? (
                <View style={styles.avatarUser}>
                  <User size={14} color={colors.primary} />
                </View>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            isChatLoading ? (
              <View style={[styles.msgRow, styles.msgRowAssistant]}>
                <View style={styles.avatarAssistant}>
                  <Sparkles size={14} color={colors.primary} />
                </View>
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <Loader2 size={15} color={colors.textMuted} />
                </View>
              </View>
            ) : null
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your Pathfinder workspace…"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            multiline
            maxLength={2000}
            onSubmitEditing={() => send(input)}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isChatLoading) && styles.sendDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || isChatLoading}
            accessibilityLabel="Send message"
          >
            {isChatLoading ? (
              <Loader2 size={16} color={colors.primaryForeground} />
            ) : (
              <Send size={16} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: { fontSize: 13, color: colors.foreground, lineHeight: 19 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  strong: { fontWeight: "800" as const },
  list_item: { marginBottom: 2 },
  code_inline: {
    backgroundColor: "#e9efeb",
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
  },
  fence: {
    backgroundColor: "#17252a",
    color: "#e7f1ec",
    borderRadius: 8,
    padding: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    borderWidth: 0,
  },
  code_block: {
    backgroundColor: "#17252a",
    color: "#e7f1ec",
    borderRadius: 8,
    padding: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    borderWidth: 0,
  },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: colors.heading },
  headerSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  list: { padding: spacing.lg, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: 13, color: colors.textMuted },
  suggested: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  suggestedChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestedChipText: { fontSize: 11, fontWeight: "700", color: colors.primary },

  msgRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md, alignItems: "flex-start" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  avatarAssistant: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarUser: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  bubble: { maxWidth: "78%", borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleUser: { backgroundColor: colors.primarySoft },
  bubbleAssistant: { backgroundColor: colors.muted },
  bubbleTextUser: { fontSize: 13, color: colors.primaryForeground, lineHeight: 18 },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 13,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.5 },
});
