import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Bot, Plus, TriangleAlert, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { aiAgentApi } from "@/lib/api";

const STARTER_PROMPTS = [
  "Analyze my resume",
  "Help me improve my skills",
  "Prepare me for an interview",
  "Ask me questions based on my resume",
  "Explain what I should learn next",
];

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const serverMessage = (error.response?.data as { error?: string } | undefined)?.error;
    return serverMessage || error.message || "The AI agent is unavailable right now.";
  }
  return error instanceof Error ? error.message : "The AI agent is unavailable right now.";
}

export function AiAgentDrawer({
  open,
  onClose,
  hasResume,
  onUpload,
  initialPrompt,
}: {
  open: boolean;
  onClose: () => void;
  hasResume: boolean;
  onUpload: () => void;
  initialPrompt?: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const lastSentRef = useRef<string | null>(null);

  const chatMutation = useMutation({
    // Streams SSE deltas into the assistant message as they arrive.
    mutationFn: async (vars: { message: string; conversationId?: string }) => {
      let streamedText = "";
      let appended = false;
      for await (const event of aiAgentApi.chatStream(vars)) {
        if (event.type === "meta") {
          setConversationId(event.conversationId);
        } else if (event.type === "delta") {
          streamedText += event.text;
          const text = streamedText;
          if (!appended) {
            appended = true;
            setMessages(current => [...current, { role: "assistant", content: text }]);
          } else {
            setMessages(current => {
              const next = [...current];
              next[next.length - 1] = { role: "assistant", content: text };
              return next;
            });
          }
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      }
      if (!streamedText.trim()) throw new Error("Nk returned an empty response — please try again.");
      return streamedText;
    },
    onError: (mutationError: unknown) => setError(errorMessage(mutationError)),
  });

  const newChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    lastSentRef.current = null;
  };

  const send = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || chatMutation.isPending) return;
    lastSentRef.current = trimmed;
    setError(null);
    setMessages(current => [...current, { role: "user", content: trimmed }]);
    chatMutation.mutate({ message: trimmed, conversationId });
  };

  const retry = () => {
    const last = lastSentRef.current;
    if (!last || chatMutation.isPending) return;
    setError(null);
    chatMutation.mutate({ message: last, conversationId });
  };

  // When opened from a practice drill, auto-send the drill's starter prompt once.
  const consumedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && hasResume && initialPrompt && consumedPromptRef.current !== initialPrompt) {
      consumedPromptRef.current = initialPrompt;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasResume, initialPrompt]);

  if (!open) return null;

  return (
    <div className="help-drawer-backdrop" onClick={onClose}>
      <aside className="help-drawer ai-agent-drawer" onClick={event => event.stopPropagation()}>
        <div className="help-drawer__header">
          <div>
            <p className="eyebrow eyebrow--green"><Bot size={14} /> NK</p>
            <strong>Nk</strong>
            <small>Personalized Career &amp; Interview Assistant</small>
          </div>
          <span className="agent-mode-chip" title="Text mode — voice and video coming soon">Text</span>
          <button className="agent-new-chat" onClick={newChat} disabled={chatMutation.isPending} title="Start a new conversation"><Plus size={13} /> New chat</button>
          <button className="help-drawer__close" onClick={onClose} aria-label="Close Nk"><X size={17} /></button>
        </div>
        {!hasResume ? (
          <div className="admin-empty locked-state agent-empty">
            <Bot size={28} />
            <strong>Upload your resume first</strong>
            <p>Upload your resume first so I can personalize your practice and career guidance.</p>
            <button className="primary-button" onClick={onUpload}><Upload size={16} /> Upload Resume</button>
          </div>
        ) : (
          <>
            {error ? (
              <div className="agent-error" role="alert">
                <TriangleAlert size={14} />
                <span>{error}</span>
                <button onClick={retry} disabled={chatMutation.isPending}>Retry</button>
              </div>
            ) : null}
            <AIChatBox
              messages={messages}
              onSendMessage={send}
              isLoading={chatMutation.isPending}
              height="100%"
              className="agent-chat"
              placeholder="Ask your question…"
              loadingText="Nk is thinking…"
              emptyStateMessage="Ask me anything — coding, concepts, interview prep, or your resume."
              suggestedPrompts={STARTER_PROMPTS}
            />
          </>
        )}
      </aside>
    </div>
  );
}
