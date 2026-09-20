import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Toast from "react-native-toast-message";
import { queryKeys, resumeApi, supportApi } from "../api";
import type { ChatMessage, ExtractedResume } from "../api/types";
import { useAuth } from "../hooks/useAuth";
import { pickResume } from "../lib/pickResume";
import { skillTones, type SkillTone } from "../theme";

export type Skill = { name: string; level: number; tone: SkillTone };

export type AppNotification = {
  id: number;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

type AppDataValue = {
  skills: Skill[];
  extraction: ExtractedResume | null;
  completedMoves: number[];
  notifications: AppNotification[];
  resumeLoading: boolean;
  isExtracting: boolean;
  isSavingEdits: boolean;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  uploadResume: () => Promise<void>;
  addSkill: (skill: Skill) => void;
  toggleMove: (id: number) => void;
  saveExtraction: (next: ExtractedResume) => void;
  sendHelpMessage: (content: string) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: number) => void;
  hasUnreadNotifications: boolean;
  refetchResume: () => void;
};

const AppDataContext = createContext<AppDataValue | null>(null);

function toSkills(extracted: ExtractedResume): Skill[] {
  return extracted.skills.map((skill, index) => ({
    name: skill.name,
    level: skill.level,
    tone: skillTones[index % skillTones.length],
  }));
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [extraction, setExtraction] = useState<ExtractedResume | null>(null);
  const [completedMoves, setCompletedMoves] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your friend. How can I help you?" },
  ]);

  const resumeQuery = useQuery({
    queryKey: queryKeys.resumeLatest,
    queryFn: resumeApi.latest,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (resumeQuery.data) {
      const extracted = resumeQuery.data;
      setExtraction(extracted);
      setSkills(toSkills(extracted));
    }
  }, [resumeQuery.data]);

  // Reset per-user state when the account changes or logs out.
  useEffect(() => {
    if (!user) {
      setSkills([]);
      setExtraction(null);
      setCompletedMoves([]);
      setNotifications([]);
      setChatMessages([{ role: "assistant", content: "Hi! I'm your friend. How can I help you?" }]);
    }
  }, [user?.id, user]);

  const extractResumeMutation = useMutation({
    mutationFn: resumeApi.extractSkills,
    onSuccess: async result => {
      setExtraction(result);
      setSkills(toSkills(result));
      await queryClient.invalidateQueries({ queryKey: queryKeys.resumeLatest });
      Toast.show({ type: "success", text1: `${result.skills.length} skills extracted from your resume.` });
    },
    onError: (error: unknown) =>
      Toast.show({
        type: "error",
        text1: error instanceof Error ? error.message : "Resume extraction failed. Please try again.",
      }),
  });

  const saveResumeMutation = useMutation({
    mutationFn: resumeApi.saveEdits,
    onSuccess: () => Toast.show({ type: "success", text1: "Your edited skills were saved." }),
    onError: (error: unknown) =>
      Toast.show({
        type: "error",
        text1: error instanceof Error ? error.message : "Could not save skill edits.",
      }),
  });

  const supportChatMutation = useMutation({
    mutationFn: supportApi.chat,
    onSuccess: response =>
      setChatMessages(current => [...current, { role: "assistant", content: response.content }]),
    onError: (error: unknown) =>
      Toast.show({
        type: "error",
        text1: error instanceof Error ? error.message : "The Help Center assistant is unavailable right now.",
      }),
  });

  // Generate notifications from actual resume data (same rules as the web app).
  useEffect(() => {
    if (!extraction) {
      setNotifications([]);
      return;
    }
    const notifs: AppNotification[] = [];
    if (skills.length > 0) {
      notifs.push({ id: 1, title: "Resume analyzed", body: `${skills.length} skills extracted from your resume.`, time: "Just now", read: false });
    }
    if (extraction.education.length > 0) {
      notifs.push({ id: 2, title: "Education detected", body: `${extraction.education.length} education entries found in your resume.`, time: "Just now", read: false });
    }
    if (extraction.projects.length > 0) {
      notifs.push({ id: 3, title: "Projects found", body: `${extraction.projects.length} project${extraction.projects.length > 1 ? "s" : ""} detected in your resume.`, time: "Just now", read: true });
    }
    setNotifications(notifs);
  }, [extraction, skills]);

  const uploadResume = useCallback(async () => {
    if (extractResumeMutation.isPending) return;
    const result = await pickResume();
    if (result.status === "cancelled") return;
    if (result.status === "error") {
      Toast.show({ type: "error", text1: result.message });
      return;
    }
    Toast.show({ type: "info", text1: "Uploading resume and reading your skill signal…" });
    extractResumeMutation.mutate(result.file);
  }, [extractResumeMutation]);

  const addSkill = useCallback((skill: Skill) => {
    setSkills(current => {
      if (current.some(item => item.name === skill.name)) {
        Toast.show({ type: "info", text1: `${skill.name} is already on your profile.` });
        return current;
      }
      Toast.show({ type: "success", text1: `${skill.name} added to your skill graph.` });
      return [...current, skill];
    });
  }, []);

  const toggleMove = useCallback((id: number) => {
    setCompletedMoves(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id],
    );
  }, []);

  const saveExtraction = useCallback(
    (next: ExtractedResume) => {
      setExtraction(next);
      setSkills(toSkills(next));
      saveResumeMutation.mutate({
        resumeId: next.resumeId,
        skills: next.skills,
        summary: next.summary,
        reviewNotes: next.reviewNotes,
      });
    },
    [saveResumeMutation],
  );

  const sendHelpMessage = useCallback(
    (content: string) => {
      setChatMessages(current => {
        const next: ChatMessage[] = [...current, { role: "user", content }];
        supportChatMutation.mutate({
          messages: next
            .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
            .slice(-12),
        });
        return next;
      });
    },
    [supportChatMutation],
  );

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(current => current.map(n => ({ ...n, read: true })));
  }, []);

  const markNotificationRead = useCallback((id: number) => {
    setNotifications(current => current.map(n => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const hasUnreadNotifications = notifications.some(n => !n.read);

  const value = useMemo<AppDataValue>(
    () => ({
      skills,
      extraction,
      completedMoves,
      notifications,
      resumeLoading: resumeQuery.isLoading,
      isExtracting: extractResumeMutation.isPending,
      isSavingEdits: saveResumeMutation.isPending,
      chatMessages,
      isChatLoading: supportChatMutation.isPending,
      uploadResume,
      addSkill,
      toggleMove,
      saveExtraction,
      sendHelpMessage,
      markAllNotificationsRead,
      markNotificationRead,
      hasUnreadNotifications,
      refetchResume: () => void resumeQuery.refetch(),
    }),
    [
      skills,
      extraction,
      completedMoves,
      notifications,
      resumeQuery,
      extractResumeMutation.isPending,
      saveResumeMutation.isPending,
      chatMessages,
      supportChatMutation.isPending,
      uploadResume,
      addSkill,
      toggleMove,
      saveExtraction,
      sendHelpMessage,
      markAllNotificationsRead,
      markNotificationRead,
      hasUnreadNotifications,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
