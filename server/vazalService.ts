import { spawn } from "child_process";
import path from "path";

export interface VazalMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface VazalResponse {
  content: string;
  finished: boolean;
  files?: string[];
}

export interface ExecuteResult {
  result: string;
  files: string[];
}

export interface ClassifyResult {
  type: "CHAT" | "TASK";
  response?: string;
  description?: string;
}

export interface PlanResult {
  plan: string[];
  estimated_time: string;
}

import os from "os";

// Auto-detect Vazal path based on OS
function getVazalPath(): string {
  if (process.env.VAZAL_PATH) return process.env.VAZAL_PATH;
  const homeDir = os.homedir();
  return path.join(homeDir, "OpenManus");
}

// Get Python path (use venv)
function getPythonPath(vazalPath: string): string {
  return path.join(vazalPath, ".venv", "bin", "python3");
}

const vazalPath = getVazalPath();
const wrapperPath = path.join(process.cwd(), "server", "vazal_wrapper.py");

/**
 * Run vazal_wrapper.py with specified mode
 */
async function runWrapper(prompt: string, mode: "classify" | "plan" | "execute"): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath(vazalPath);
    const python = spawn(pythonPath, [wrapperPath, prompt, `--mode=${mode}`], {
      cwd: vazalPath,
      env: { ...process.env, VAZAL_PATH: vazalPath },
    });

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    python.on("error", (err) => {
      reject(err);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      python.kill();
      reject(new Error("Vazal execution timed out"));
    }, 300000);
  });
}

/**
 * Classify user intent: CHAT or TASK
 */
export async function classifyIntent(prompt: string): Promise<ClassifyResult> {
  try {
    const result = await runWrapper(prompt, "classify");
    return JSON.parse(result);
  } catch (error) {
    console.error("[Vazal Classify Error]", error);
    // Default to TASK on error
    return { type: "TASK", description: prompt };
  }
}

/**
 * Generate execution plan for a task
 */
export async function generatePlan(prompt: string): Promise<PlanResult> {
  try {
    const result = await runWrapper(prompt, "plan");
    return JSON.parse(result);
  } catch (error) {
    console.error("[Vazal Plan Error]", error);
    // Return default plan on error
    return {
      plan: ["Analyze the request", "Execute the task", "Return results"],
      estimated_time: "30 seconds"
    };
  }
}

/**
 * Execute Vazal AI agent with a user prompt
 * Returns the final response with files after agent completes
 */
export async function executeVazalCommand(
  prompt: string,
  userId: number
): Promise<ExecuteResult> {
  try {
    const result = await runWrapper(prompt, "execute");
    
    // Try to parse as JSON (new format)
    try {
      const parsed = JSON.parse(result);
      if (parsed.type === "result") {
        return {
          result: parsed.content || "Task completed.",
          files: parsed.files || []
        };
      }
    } catch {
      // Not JSON, use legacy parsing
    }
    
    // Fallback to legacy parsing
    return {
      result: extractFinalAnswer(result),
      files: extractFiles(result)
    };
  } catch (error) {
    console.error('[Vazal Error]', error);
    throw new Error(`Vazal execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract file paths from output
 */
function extractFiles(output: string): string[] {
  const filePathRegex = /(?:saved|created|output).*?(?:to|at|:)?\s*([\w\/\.\-_]+\.(?:pptx?|docx?|pdf|xlsx?|png|jpg|jpeg|csv|txt|html))/gi;
  const files: string[] = [];
  let match;
  while ((match = filePathRegex.exec(output)) !== null) {
    files.push(match[1].split('/').pop() || match[1]);
  }
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Full flow: classify -> plan (if TASK) -> execute
 * Returns structured response with plan for user confirmation
 */
export async function executeWithPlan(
  prompt: string,
  userId: number,
  skipPlan: boolean = false
): Promise<{ type: "CHAT" | "TASK"; response?: string; plan?: PlanResult; result?: string }> {
  // Step 1: Classify intent
  const classification = await classifyIntent(prompt);
  
  if (classification.type === "CHAT") {
    return {
      type: "CHAT",
      response: classification.response || "Hello! How can I help you?"
    };
  }
  
  // Step 2: Generate plan (unless skipped)
  if (!skipPlan) {
    const plan = await generatePlan(prompt);
    return {
      type: "TASK",
      plan: plan
    };
  }
  
  // Step 3: Execute (only if plan was skipped/confirmed)
  const result = await executeVazalCommand(prompt, userId);
  return {
    type: "TASK",
    result: result
  };
}

/**
 * Extract final answer from Vazal output, filtering debug logs
 */
function extractFinalAnswer(fullOutput: string): string {
  // Look for the final answer after "🤖 Vazal:" marker
  const vazalMarker = "🤖 Vazal:";
  let finalAnswer = "";
  
  if (fullOutput.includes(vazalMarker)) {
    // Extract everything after the last "🤖 Vazal:" marker
    const parts = fullOutput.split(vazalMarker);
    const lastPart = parts[parts.length - 1].trim();
    
    // Filter out internal debugging messages from Vazal's thoughts
    const lines = lastPart.split("\n");
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip internal debugging/planning messages
      if (trimmed.includes("The error message indicates")) return false;
      if (trimmed.includes("Let's address this by")) return false;
      if (trimmed.includes("Let's proceed to")) return false;
      if (trimmed.includes("I'll make sure")) return false;
      if (trimmed.includes("Here's the strategy:")) return false;
      if (trimmed.startsWith("1.") && trimmed.includes("Slide")) return false;
      if (trimmed.startsWith("2.") && trimmed.includes("Slide")) return false;
      if (trimmed.startsWith("3.") && trimmed.includes("Slide")) return false;
      if (trimmed.startsWith("4.") && trimmed.includes("Slide")) return false;
      return true;
    });
    finalAnswer = meaningfulLines.join("\n").trim();
  }
  
  // If no Vazal marker, look for actual results
  if (!finalAnswer) {
    const lines = fullOutput.split("\n");
    const resultLines = lines.filter(line => {
      const trimmed = line.trim();
      // Keep only actual results, not debug logs
      if (!trimmed) return false;
      if (trimmed.startsWith("INFO")) return false;
      if (trimmed.startsWith("DEBUG")) return false;
      if (trimmed.startsWith("[Vazal Error]")) return false;
      if (trimmed.includes("[browser_use]")) return false;
      if (trimmed.includes("[chromadb")) return false;
      if (trimmed.includes("PyTorch version")) return false;
      if (trimmed.includes("Anonymized telemetry")) return false;
      if (trimmed.includes("🤖 Vazal is waking up")) return false;
      if (trimmed.includes("✅ Ready!")) return false;
      if (trimmed.includes("🚀 Starting Task:")) return false;
      if (trimmed.includes("✨ Vazal's thoughts:")) return false;
      if (trimmed.includes("🛠️ Vazal selected")) return false;
      if (trimmed.includes("🧰 Tools being prepared")) return false;
      if (trimmed.includes("🔧 Tool arguments:")) return false;
      if (trimmed.includes("🔧 Activating tool:")) return false;
      if (trimmed.includes("🎯 Tool") && trimmed.includes("completed its mission")) return false;
      if (trimmed.includes("Executing step")) return false;
      if (trimmed.includes("Token usage:")) return false;
      // Keep actual results
      if (trimmed.includes("saved successfully")) return true;
      if (trimmed.includes("created successfully")) return true;
      if (trimmed.includes("The answer") || trimmed.includes("The result")) return true;
      return false;
    });
    finalAnswer = resultLines.join("\n").trim();
  }
  
  // Extract file paths
  const filePathRegex = /(?:saved|created|output).*?(?:to|at|:)\s+([\w\/\.\-_]+\.(?:pptx?|docx?|pdf|xlsx?|png|jpg|jpeg|csv|txt))/gi;
  const files: string[] = [];
  let match;
  while ((match = filePathRegex.exec(fullOutput)) !== null) {
    files.push(match[1]);
  }
  
  // If still empty but we have files, mention them
  if (!finalAnswer && files.length > 0) {
    finalAnswer = `Task completed. Created ${files.length} file(s): ${files.join(', ')}`;
  }
  
  // Last resort fallback
  if (!finalAnswer) {
    finalAnswer = fullOutput.trim() || "Vazal completed the task.";
  }
  
  return finalAnswer;
}

/**
 * Check if Vazal AI is installed and configured
 */
export async function checkVazalInstallation(): Promise<boolean> {
  try {
    const fs = await import("fs/promises");
    await fs.access(path.join(vazalPath, "main.py"));
    return true;
  } catch {
    return false;
  }
}
