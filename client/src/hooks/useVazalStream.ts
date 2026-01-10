import { useState, useCallback } from "react";

export interface StreamEvent {
  type: "thinking" | "action" | "result" | "error" | "done";
  content: string;
}

export interface UseVazalStreamOptions {
  onThinking?: (content: string) => void;
  onAction?: (content: string) => void;
  onResult?: (content: string) => void;
  onError?: (content: string) => void;
  onDone?: () => void;
}

export function useVazalStream(options: UseVazalStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [currentResult, setCurrentResult] = useState<string>("");

  const stream = useCallback(
    async (prompt: string, conversationId?: number) => {
      setIsStreaming(true);
      setThinkingSteps([]);
      setCurrentResult("");

      try {
        const response = await fetch("/api/vazal/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies for auth
          body: JSON.stringify({ prompt, conversationId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Stream request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6));

                switch (event.type) {
                  case "thinking":
                    setThinkingSteps((prev) => [...prev, event.content]);
                    options.onThinking?.(event.content);
                    break;
                  case "action":
                    setThinkingSteps((prev) => [...prev, event.content]);
                    options.onAction?.(event.content);
                    break;
                  case "result":
                    setCurrentResult(event.content);
                    options.onResult?.(event.content);
                    break;
                  case "error":
                    options.onError?.(event.content);
                    break;
                  case "done":
                    options.onDone?.();
                    break;
                }
              } catch (e) {
                console.error("Failed to parse SSE event:", e);
              }
            }
          }
        }
      } catch (error: any) {
        options.onError?.(error.message || "Stream failed");
        throw error;
      } finally {
        setIsStreaming(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setThinkingSteps([]);
    setCurrentResult("");
  }, []);

  return {
    stream,
    isStreaming,
    thinkingSteps,
    currentResult,
    reset,
  };
}
