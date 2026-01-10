import { spawn, ChildProcess } from "child_process";
import path from "path";

interface VazalSession {
  process: ChildProcess;
  lastUsed: number;
  ready: boolean;
}

/**
 * Manages persistent Vazal processes per user
 * Keeps Python processes warm to reduce response time from 30s to ~5s
 */
class VazalSessionManager {
  private sessions: Map<number, VazalSession> = new Map();
  private readonly IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup idle sessions every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 2 * 60 * 1000);
  }

  /**
   * Get or create a persistent Vazal process for a user
   */
  private async getOrCreateSession(userId: number): Promise<VazalSession> {
    let session = this.sessions.get(userId);

    if (session && session.process.killed) {
      // Process was killed, remove it
      this.sessions.delete(userId);
      session = undefined;
    }

    if (!session) {
      console.log(`[SessionManager] Creating new session for user ${userId}`);
      session = await this.createSession(userId);
      this.sessions.set(userId, session);
    }

    session.lastUsed = Date.now();
    return session;
  }

  /**
   * Create a new persistent Vazal process
   */
  private async createSession(userId: number): Promise<VazalSession> {
    const vazalPath = process.env.VAZAL_PATH || "/home/ubuntu/vazal-repo";
    
    // Spawn Vazal in persistent mode
    const vazalProcess = spawn("python3", ["main.py", "--persistent"], {
      cwd: vazalPath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const session: VazalSession = {
      process: vazalProcess,
      lastUsed: Date.now(),
      ready: false,
    };

    // Wait for "✅ Ready!" message
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Vazal initialization timeout"));
      }, 60000); // 60 second timeout

      const dataHandler = (data: Buffer) => {
        const text = data.toString();
        console.log(`[SessionManager User ${userId}]`, text.trim());

        if (text.includes("✅ Ready!")) {
          session.ready = true;
          clearTimeout(timeout);
          vazalProcess.stdout?.off("data", dataHandler);
          resolve();
        }
      };

      vazalProcess.stdout?.on("data", dataHandler);

      vazalProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      vazalProcess.on("exit", (code) => {
        if (!session.ready) {
          clearTimeout(timeout);
          reject(new Error(`Vazal process exited with code ${code} before ready`));
        }
      });
    });

    // Handle stderr
    vazalProcess.stderr?.on("data", (data) => {
      console.error(`[SessionManager User ${userId} Error]`, data.toString());
    });

    return session;
  }

  /**
   * Execute a prompt on a persistent Vazal process
   */
  async execute(userId: number, prompt: string): Promise<string> {
    const session = await this.getOrCreateSession(userId);

    if (!session.process.stdin) {
      throw new Error("Vazal process stdin not available");
    }

    // Send request as JSON
    const request = JSON.stringify({ prompt }) + "\n";
    session.process.stdin.write(request);

    // Collect response until we see "🤖 Vazal:" marker
    return new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => {
        reject(new Error("Vazal execution timeout"));
      }, 120000); // 2 minute timeout

      const dataHandler = (data: Buffer) => {
        const text = data.toString();
        output += text;
        console.log(`[SessionManager User ${userId}]`, text.trim());

        // Look for final answer marker
        if (text.includes("🤖 Vazal:")) {
          clearTimeout(timeout);
          session.process.stdout?.off("data", dataHandler);
          
          // Extract response after "🤖 Vazal:" marker
          const match = output.match(/🤖 Vazal:\s*([\s\S]+?)(?=\n|$)/);
          if (match) {
            resolve(match[1].trim());
          } else {
            resolve(output.trim());
          }
        }
      };

      session.process.stdout?.on("data", dataHandler);

      session.process.on("error", (error) => {
        clearTimeout(timeout);
        session.process.stdout?.off("data", dataHandler);
        reject(error);
      });

      session.process.on("exit", () => {
        clearTimeout(timeout);
        session.process.stdout?.off("data", dataHandler);
        this.sessions.delete(userId);
        reject(new Error("Vazal process exited unexpectedly"));
      });
    });
  }

  /**
   * Kill a user's session
   */
  killSession(userId: number): void {
    const session = this.sessions.get(userId);
    if (session) {
      console.log(`[SessionManager] Killing session for user ${userId}`);
      session.process.kill();
      this.sessions.delete(userId);
    }
  }

  /**
   * Cleanup idle sessions (not used for 10+ minutes)
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    this.sessions.forEach((session, userId) => {
      if (now - session.lastUsed > this.IDLE_TIMEOUT) {
        console.log(`[SessionManager] Cleaning up idle session for user ${userId}`);
        this.killSession(userId);
      }
    });
  }

  /**
   * Shutdown all sessions
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.forEach((_, userId) => {
      this.killSession(userId);
    });
  }
}

// Singleton instance
export const vazalSessionManager = new VazalSessionManager();

// Cleanup on process exit
process.on("SIGINT", () => {
  vazalSessionManager.shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  vazalSessionManager.shutdown();
  process.exit(0);
});
