import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface VazalMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface VazalResponse {
  content: string;
  finished: boolean;
  files?: string[];
}

/**
 * Get the Vazal installation path based on environment or OS
 */
function getVazalPath(): string {
  // Check environment variable first
  if (process.env.VAZAL_PATH) {
    return process.env.VAZAL_PATH;
  }
  
  // Auto-detect based on OS
  const homeDir = os.homedir();
  const platform = os.platform();
  
  if (platform === "darwin") {
    // macOS - check common locations
    return path.join(homeDir, "OpenManus");
  } else {
    // Linux/Ubuntu
    return path.join(homeDir, "OpenManus");
  }
}

/**
 * Get the Python executable path (use venv if available)
 */
function getPythonPath(vazalPath: string): string {
  const venvPython = path.join(vazalPath, ".venv", "bin", "python3");
  return venvPython;
}

/**
 * Execute Vazal AI agent with a user prompt
 * Returns a stream of responses as the agent thinks and acts
 */
export async function* executeVazal(
  prompt: string,
  onProgress?: (message: string) => void
): AsyncGenerator<VazalResponse> {
  const vazalPath = getVazalPath();
  const pythonPath = getPythonPath(vazalPath);
  
  // Use wrapper script to isolate Python event loop
  const wrapperPath = path.join(__dirname, "vazal_wrapper.py");
  console.log('[Vazal] Using wrapper at:', wrapperPath);
  console.log('[Vazal] Using Python at:', pythonPath);
  console.log('[Vazal] Vazal path:', vazalPath);
  
  const pythonProcess = spawn(pythonPath, [wrapperPath, prompt], {
    env: {
      ...process.env,
      VAZAL_PATH: vazalPath,
      PYTHONUNBUFFERED: "1", // Disable Python output buffering
      PYTHONIOENCODING: "utf-8", // Ensure UTF-8 encoding
    },
    detached: false, // Keep attached to capture output
    stdio: ["ignore", "pipe", "pipe"], // stdin ignored, stdout/stderr piped
  });

  let buffer = "";
  let allOutput: string[] = [];
  let finished = false;

  // Handle stdout (agent output)
  pythonProcess.stdout.on("data", (data) => {
    const text = data.toString();
    buffer += text;
    allOutput.push(text);
    
    // Parse agent output (look for thought/action/observation markers)
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        onProgress?.(line);
      }
    }
  });

  // Handle stderr (errors)
  pythonProcess.stderr.on("data", (data) => {
    console.error("[Vazal Error]", data.toString());
  });

  // Wait for process to complete
  await new Promise<void>((resolve, reject) => {
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        finished = true;
        resolve();
      } else {
        reject(new Error(`Vazal process exited with code ${code}`));
      }
    });

    pythonProcess.on("error", (error) => {
      reject(error);
    });
  });

  // Parse output to extract final answer and filter debug logs
  const fullOutput = allOutput.join("") + buffer;
  
  // Look for the final answer after "🤖 Vazal:" marker
  const vazalMarker = "🤖 Vazal:";
  let finalAnswer = "";
  
  if (fullOutput.includes(vazalMarker)) {
    // Extract everything after the last "🤖 Vazal:" marker
    const parts = fullOutput.split(vazalMarker);
    finalAnswer = parts[parts.length - 1].trim();
  } else {
    // Fallback: filter out INFO/DEBUG lines and return remaining content
    const lines = fullOutput.split("\n");
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip empty lines and log lines
      if (!trimmed) return false;
      if (trimmed.startsWith("INFO")) return false;
      if (trimmed.startsWith("DEBUG")) return false;
      if (trimmed.includes("[browser_use]")) return false;
      if (trimmed.includes("[chromadb")) return false;
      if (trimmed.includes("PyTorch version")) return false;
      if (trimmed.includes("Anonymized telemetry")) return false;
      if (trimmed.includes("🤖 Vazal is waking up")) return false;
      if (trimmed.includes("✅ Ready!")) return false;
      if (trimmed.includes("🚀 Starting Task:")) return false;
      return true;
    });
    finalAnswer = meaningfulLines.join("\n").trim();
  }
  
  // If still empty, provide a helpful message
  if (!finalAnswer) {
    finalAnswer = "Vazal completed the task but did not return a text response. Check if files were created.";
  }
  
  yield {
    content: finalAnswer,
    finished: true,
  };
}

/**
 * Check if Vazal AI is installed and configured
 */
export async function checkVazalInstallation(): Promise<boolean> {
  const vazalPath = getVazalPath();
  
  try {
    const fs = await import("fs/promises");
    await fs.access(path.join(vazalPath, "main.py"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a Vazal command and return the complete result
 */
export async function executeVazalCommand(prompt: string): Promise<string> {
  const responses: string[] = [];
  
  for await (const response of executeVazal(prompt, (msg) => {
    console.log('[Vazal]', msg);
  })) {
    responses.push(response.content);
  }
  
  return responses.join("\n");
}
