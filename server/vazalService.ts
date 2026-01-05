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

/**
 * Execute Vazal AI agent with a user prompt
 * Returns a stream of responses as the agent thinks and acts
 */
export async function* executeVazal(
  prompt: string,
  onProgress?: (message: string) => void
): AsyncGenerator<VazalResponse> {
  // Path to Vazal AI installation (adjust based on deployment)
  // Default to ~/OpenManus on Mac, or use VAZAL_PATH env variable
  const vazalPath = process.env.VAZAL_PATH || "/Users/I048134/OpenManus";
  
  // Spawn Python process to run Vazal with --prompt argument
  const pythonProcess = spawn("python3", ["main.py", "--prompt", prompt], {
    cwd: vazalPath,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1", // Disable Python output buffering
    },
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

  // Return final response with all captured output
  const finalOutput = allOutput.join("").trim() || buffer.trim() || "No output received from Vazal AI. Check server logs for errors.";
  yield {
    content: finalOutput,
    finished: true,
  };
}

/**
 * Check if Vazal AI is installed and configured
 */
export async function checkVazalInstallation(): Promise<boolean> {
  const vazalPath = process.env.VAZAL_PATH || "/Users/I048134/OpenManus";
  
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
