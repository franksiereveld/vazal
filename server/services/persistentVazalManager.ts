import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

/**
 * Persistent Vazal Process Manager
 * 
 * Keeps a warm Python process running to avoid cold start delays.
 * Communicates with Vazal via stdin/stdout using JSON messages.
 * 
 * Benefits:
 * - First request: ~30s (cold start)
 * - Subsequent requests: ~5s (warm process)
 * 
 * Protocol:
 * - Send: JSON object with { prompt, mode } on stdin
 * - Receive: JSON lines on stdout (streaming events)
 * - Final: JSON object with { done: true, result: "..." }
 */

interface VazalSession {
  process: ChildProcess;
  userId: number;
  lastActivity: Date;
  isReady: boolean;
  pendingRequests: Map<string, {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }>;
}

class PersistentVazalManager extends EventEmitter {
  private sessions: Map<number, VazalSession> = new Map();
  private readonly vazalPath: string;
  private readonly idleTimeout: number = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.vazalPath = process.env.VAZAL_PATH || "/Users/I048134/OpenManus";
    this.startCleanupInterval();
  }

  /**
   * Start periodic cleanup of idle sessions
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Clean up sessions that have been idle too long
   */
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

  /**
   * Get or create a warm Vazal session for a user
   */
  async getSession(userId: number): Promise<VazalSession> {
    let session = this.sessions.get(userId);
    
    if (session && session.isReady) {
      session.lastActivity = new Date();
      return session;
    }

    // Create new session
    return this.createSession(userId);
  }

  /**
   * Create a new persistent Vazal session
   */
  private async createSession(userId: number): Promise<VazalSession> {
    console.log(`[PersistentVazal] Creating new session for user ${userId}`);

    const childProcess = spawn("python3", ["main.py", "--persistent"], {
      cwd: this.vazalPath,
      env: { ...process.env, VAZAL_PATH: this.vazalPath },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const session: VazalSession = {
      process: childProcess,
      userId,
      lastActivity: new Date(),
      isReady: false,
      pendingRequests: new Map(),
    };

    // Handle stdout
    let buffer = "";
    childProcess.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.handleEvent(session, event);
        } catch (e) {
          // Not JSON, might be a log message
          console.log(`[PersistentVazal] Log: ${line}`);
        }
      }
    });

    // Handle stderr
    childProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      // Filter out common warnings
      if (!msg.includes("tokenizers") && !msg.includes("huggingface")) {
        console.error(`[PersistentVazal] Error: ${msg}`);
      }
    });

    // Handle process exit
    childProcess.on("close", (code: number | null) => {
      console.log(`[PersistentVazal] Session for user ${userId} exited with code ${code}`);
      this.sessions.delete(userId);
      
      // Reject any pending requests
      session.pendingRequests.forEach((request) => {
        request.reject(new Error("Vazal process terminated unexpectedly"));
      });
    });

    childProcess.on("error", (err: Error) => {
      console.error(`[PersistentVazal] Process error for user ${userId}:`, err);
      this.sessions.delete(userId);
    });

    this.sessions.set(userId, session);

    // Wait for ready signal
    await this.waitForReady(session);
    
    return session;
  }

  /**
   * Wait for the Vazal process to be ready
   */
  private waitForReady(session: VazalSession): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Vazal process failed to start within timeout"));
      }, 60000); // 60 second timeout for cold start

      const checkReady = () => {
        if (session.isReady) {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check periodically
      const interval = setInterval(() => {
        if (session.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);

      // Also listen for ready event
      this.once(`ready:${session.userId}`, () => {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      });

      // Mark as ready after a short delay (Vazal doesn't send explicit ready signal)
      setTimeout(() => {
        session.isReady = true;
        this.emit(`ready:${session.userId}`);
      }, 5000);
    });
  }

  /**
   * Handle events from Vazal process
   */
  private handleEvent(session: VazalSession, event: any): void {
    if (event.type === "ready") {
      session.isReady = true;
      this.emit(`ready:${session.userId}`);
    } else if (event.done && event.requestId) {
      const request = session.pendingRequests.get(event.requestId);
      if (request) {
        request.resolve(event.result || "");
        session.pendingRequests.delete(event.requestId);
      }
    } else if (event.error && event.requestId) {
      const request = session.pendingRequests.get(event.requestId);
      if (request) {
        request.reject(new Error(event.error));
        session.pendingRequests.delete(event.requestId);
      }
    }

    // Emit for streaming
    this.emit(`event:${session.userId}`, event);
  }

  /**
   * Execute a command on a warm Vazal session
   */
  async execute(userId: number, prompt: string, mode: "classify" | "plan" | "execute" = "execute"): Promise<string> {
    const session = await this.getSession(userId);
    session.lastActivity = new Date();

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      session.pendingRequests.set(requestId, { resolve, reject });

      // Send request to Vazal
      const request = JSON.stringify({ prompt, mode, requestId }) + "\n";
      session.process.stdin?.write(request);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (session.pendingRequests.has(requestId)) {
          session.pendingRequests.delete(requestId);
          reject(new Error("Request timed out"));
        }
      }, 300000);
    });
  }

  /**
   * Terminate a user's session
   */
  terminateSession(userId: number): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.process.kill();
      this.sessions.delete(userId);
    }
  }

  /**
   * Terminate all sessions
   */
  terminateAll(): void {
    const userIds = Array.from(this.sessions.keys());
    for (const userId of userIds) {
      this.terminateSession(userId);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get session status for a user
   */
  getSessionStatus(userId: number): { active: boolean; lastActivity?: Date } {
    const session = this.sessions.get(userId);
    if (session) {
      return {
        active: session.isReady,
        lastActivity: session.lastActivity,
      };
    }
    return { active: false };
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

// Singleton instance
export const persistentVazalManager = new PersistentVazalManager();

// Cleanup on process exit
process.on("exit", () => {
  persistentVazalManager.terminateAll();
});

process.on("SIGINT", () => {
  persistentVazalManager.terminateAll();
  process.exit();
});

process.on("SIGTERM", () => {
  persistentVazalManager.terminateAll();
  process.exit();
});
