import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import os from "os";

/**
 * Persistent Vazal Process Manager
 * 
 * Keeps a warm Python process running to avoid cold start delays.
 * Communicates with Vazal via stdin/stdout using JSON messages.
 * 
 * Benefits:
 * - First request: ~5-10s (cold start with model loading)
 * - Subsequent requests: <1s (warm process)
 */

interface VazalSession {
  process: ChildProcess;
  userId: number;
  lastActivity: Date;
  isReady: boolean;
  buffer: string;
  pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    mode: string;
  }>;
}

function getVazalPath(): string {
  if (process.env.VAZAL_PATH) return process.env.VAZAL_PATH;
  return path.join(os.homedir(), "OpenManus");
}

function getPythonPath(vazalPath: string): string {
  return path.join(vazalPath, ".venv", "bin", "python3");
}

class PersistentVazalManager extends EventEmitter {
  private sessions: Map<number, VazalSession> = new Map();
  private readonly vazalPath: string;
  private readonly pythonPath: string;
  private readonly idleTimeout: number = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.vazalPath = getVazalPath();
    this.pythonPath = getPythonPath(this.vazalPath);
    console.log(`[PersistentVazal] Initialized with path: ${this.vazalPath}`);
    console.log(`[PersistentVazal] Using Python: ${this.pythonPath}`);
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 60 * 1000);
  }

  private cleanupIdleSessions(): void {
    const now = new Date();
    this.sessions.forEach((session, userId) => {
      const idleTime = now.getTime() - session.lastActivity.getTime();
      if (idleTime > this.idleTimeout) {
        console.log(`[PersistentVazal] Cleaning up idle session for user ${userId}`);
        this.terminateSession(userId);
      }
    });
  }

  async getSession(userId: number): Promise<VazalSession> {
    let session = this.sessions.get(userId);
    
    if (session && session.isReady && !session.process.killed) {
      session.lastActivity = new Date();
      return session;
    }

    // Clean up dead session if exists
    if (session) {
      this.sessions.delete(userId);
    }

    return this.createSession(userId);
  }

  private async createSession(userId: number): Promise<VazalSession> {
    console.log(`[PersistentVazal] Creating new session for user ${userId}`);

    const wrapperPath = path.join(process.cwd(), "server", "persistent_wrapper.py");
    
    const childProcess = spawn(this.pythonPath, [wrapperPath], {
      cwd: this.vazalPath,
      env: { 
        ...process.env, 
        VAZAL_PATH: this.vazalPath,
        PYTHONUNBUFFERED: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const session: VazalSession = {
      process: childProcess,
      userId,
      lastActivity: new Date(),
      isReady: false,
      buffer: "",
      pendingRequests: new Map(),
    };

    // Handle stdout - parse JSON responses
    childProcess.stdout?.on("data", (data: Buffer) => {
      session.buffer += data.toString();
      
      // Process complete JSON lines
      const lines = session.buffer.split("\n");
      session.buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.handleEvent(session, event);
        } catch (e) {
          // Not JSON, log it
          console.log(`[PersistentVazal] Output: ${line}`);
        }
      }
    });

    // Handle stderr - just log
    childProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      // Filter common noise
      if (!msg.includes("tokenizers") && 
          !msg.includes("huggingface") &&
          !msg.includes("TqdmWarning")) {
        console.error(`[PersistentVazal] stderr: ${msg}`);
      }
    });

    childProcess.on("close", (code: number | null) => {
      console.log(`[PersistentVazal] Session for user ${userId} exited with code ${code}`);
      this.sessions.delete(userId);
      
      // Reject pending requests
      session.pendingRequests.forEach((request) => {
        request.reject(new Error("Vazal process terminated"));
      });
    });

    childProcess.on("error", (err: Error) => {
      console.error(`[PersistentVazal] Process error:`, err);
      this.sessions.delete(userId);
    });

    this.sessions.set(userId, session);

    // Wait for ready signal
    await this.waitForReady(session);
    
    return session;
  }

  private waitForReady(session: VazalSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Vazal process failed to start within timeout"));
      }, 60000);

      const checkReady = setInterval(() => {
        if (session.isReady) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);

      this.once(`ready:${session.userId}`, () => {
        clearInterval(checkReady);
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private handleEvent(session: VazalSession, event: any): void {
    if (event.type === "ready") {
      console.log(`[PersistentVazal] Session ${session.userId} is ready`);
      session.isReady = true;
      this.emit(`ready:${session.userId}`);
    } else if (event.type === "activity") {
      // Emit activity updates for UI
      console.log(`[PersistentVazal] Activity: ${event.message}`);
      this.emit(`activity:${session.userId}`, event);
    } else if (event.type === "progress") {
      // Emit progress updates
      this.emit(`progress:${session.userId}`, event);
    } else if (event.requestId) {
      const request = session.pendingRequests.get(event.requestId);
      if (request) {
        if (event.error) {
          request.reject(new Error(event.error));
        } else {
          request.resolve(event.result || event);
        }
        session.pendingRequests.delete(event.requestId);
      }
    }

    // Always emit all events for listeners
    this.emit(`event:${session.userId}`, event);
  }

  /**
   * Classify intent - CHAT or TASK
   */
  async classify(userId: number, prompt: string): Promise<{ type: "CHAT" | "TASK"; response?: string; description?: string }> {
    const session = await this.getSession(userId);
    return this.sendRequest(session, prompt, "classify");
  }

  /**
   * Generate execution plan
   */
  async plan(userId: number, prompt: string): Promise<{ plan: string[]; estimated_time: string }> {
    const session = await this.getSession(userId);
    return this.sendRequest(session, prompt, "plan");
  }

  /**
   * Execute full task - returns result and files
   */
  async execute(userId: number, prompt: string): Promise<{ result: string; files: string[] }> {
    const session = await this.getSession(userId);
    const result = await this.sendRequest(session, prompt, "execute");
    
    // Handle different response formats
    if (typeof result === "string") {
      return { result, files: [] };
    }
    
    return {
      result: result.content || result.result || "Task completed.",
      files: result.files || []
    };
  }

  private sendRequest(session: VazalSession, prompt: string, mode: string): Promise<any> {
    session.lastActivity = new Date();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      session.pendingRequests.set(requestId, { resolve, reject, mode });

      const request = JSON.stringify({ prompt, mode, requestId }) + "\n";
      session.process.stdin?.write(request);

      // Timeout based on mode
      const timeoutMs = mode === "execute" ? 300000 : 30000; // 5min for execute, 30s for classify/plan
      setTimeout(() => {
        if (session.pendingRequests.has(requestId)) {
          session.pendingRequests.delete(requestId);
          reject(new Error(`Request timed out (${mode})`));
        }
      }, timeoutMs);
    });
  }

  terminateSession(userId: number): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.process.kill();
      this.sessions.delete(userId);
    }
  }

  terminateAll(): void {
    for (const userId of this.sessions.keys()) {
      this.terminateSession(userId);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  getSessionStatus(userId: number): { active: boolean; lastActivity?: Date } {
    const session = this.sessions.get(userId);
    return session ? { active: session.isReady, lastActivity: session.lastActivity } : { active: false };
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const persistentVazalManager = new PersistentVazalManager();

process.on("exit", () => persistentVazalManager.terminateAll());
process.on("SIGINT", () => { persistentVazalManager.terminateAll(); process.exit(); });
process.on("SIGTERM", () => { persistentVazalManager.terminateAll(); process.exit(); });
