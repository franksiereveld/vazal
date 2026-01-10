import { spawn } from "child_process";
import { Response } from "express";

export interface StreamEvent {
  type: "thinking" | "action" | "result" | "error" | "done";
  content: string;
}

/**
 * Execute Vazal with streaming output via SSE
 */
export async function executeVazalStreaming(
  userId: number,
  prompt: string,
  res: Response
): Promise<string> {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  const sendEvent = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const vazalPath = process.env.VAZAL_PATH || "/Users/I048134/OpenManus";
  let finalResult = "";

  return new Promise((resolve, reject) => {
    // Spawn Vazal process
    const vazalProcess = spawn("python3", ["main.py", "--prompt", prompt], {
      cwd: vazalPath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    // Stream stdout in real-time
    vazalProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      output += text;

      // Parse and send different types of messages
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Classify output type and send appropriate event
        if (trimmed.includes("✨ Vazal's thoughts:")) {
          sendEvent({
            type: "thinking",
            content: trimmed.replace("✨ Vazal's thoughts:", "").trim(),
          });
        } else if (trimmed.includes("🛠️ Vazal selected") || trimmed.includes("🔧 Activating tool:")) {
          sendEvent({
            type: "action",
            content: trimmed,
          });
        } else if (trimmed.includes("🎯 Tool") && trimmed.includes("completed")) {
          sendEvent({
            type: "action",
            content: trimmed,
          });
        } else if (trimmed.includes("🤖 Vazal:")) {
          // Final answer
          finalResult = trimmed.replace("🤖 Vazal:", "").trim();
          sendEvent({
            type: "result",
            content: finalResult,
          });
        } else if (trimmed.startsWith("🚀") || trimmed.startsWith("✅") || trimmed.startsWith("🔄")) {
          // Status messages
          sendEvent({
            type: "thinking",
            content: trimmed,
          });
        } else if (trimmed.includes("🤖 Vazal is waking up")) {
          sendEvent({
            type: "thinking",
            content: "Initializing Vazal...",
          });
        }
      }
    });

    // Handle stderr (don't send to client, just log)
    vazalProcess.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.includes("Error") || text.includes("Exception")) {
        console.error("[Vazal Streaming Error]", text);
      }
    });

    // Handle process completion
    vazalProcess.on("close", (code) => {
      if (code === 0) {
        sendEvent({ type: "done", content: "" });
        res.end();
        resolve(finalResult || output);
      } else {
        sendEvent({
          type: "error",
          content: `Vazal process exited with code ${code}`,
        });
        res.end();
        reject(new Error(`Vazal process exited with code ${code}`));
      }
    });

    vazalProcess.on("error", (error) => {
      sendEvent({
        type: "error",
        content: error.message,
      });
      res.end();
      reject(error);
    });

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      vazalProcess.kill();
      sendEvent({
        type: "error",
        content: "Request timeout (5 minutes)",
      });
      res.end();
      reject(new Error("Timeout"));
    }, 5 * 60 * 1000);

    // Cleanup on client disconnect
    res.on("close", () => {
      clearTimeout(timeout);
      if (!vazalProcess.killed) {
        vazalProcess.kill();
      }
    });

    // Clear timeout on completion
    vazalProcess.on("close", () => {
      clearTimeout(timeout);
    });
  });
}
