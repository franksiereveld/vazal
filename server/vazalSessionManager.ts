import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface VazalSession {
  process: ChildProcess;
  ready: boolean;
  lastUsed: number;
}

/**
 * Manages persistent Vazal Python processes to avoid cold starts
 */
class VazalSessionManager {
  private sessions: Map<string, VazalSession> = new Map();
  private readonly IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupIdleSessions(), 60000);
  }

  /**
   * Get or create a warm Vazal session for a user
   */
  async getSession(userId: string): Promise<VazalSession> {
    const existing = this.sessions.get(userId);
    
    if (existing && existing.ready) {
      existing.lastUsed = Date.now();
      return existing;
    }

    // Create new session
    return this.createSession(userId);
  }

  /**
   * Create a new persistent Vazal process
   */
  private async createSession(userId: string): Promise<VazalSession> {
    const vazalPath = process.env.VAZAL_PATH || "/Users/I048134/OpenManus";
    const wrapperPath = path.join(__dirname, "vazal_persistent.py");

    console.log(`[VazalSession] Creating new session for user ${userId}`);

    const pythonProcess = spawn("python3", [wrapperPath], {
      env: {
        ...process.env,
        VAZAL_PATH: vazalPath,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const session: VazalSession = {
      process: pythonProcess,
      ready: false,
      lastUsed: Date.now(),
    };

    // Wait for ready signal
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Vazal session startup timeout"));
      }, 30000); // 30 second timeout

      pythonProcess.stdout.on("data", (data) => {
        const text = data.toString();
        if (text.includes("✅ Ready!")) {
          clearTimeout(timeout);
          session.ready = true;
          resolve();
        }
      });

      pythonProcess.stderr.on("data", (data) => {
        console.error(`[VazalSession] Error:`, data.toString());
      });

      pythonProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      pythonProcess.on("exit", (code) => {
        console.log(`[VazalSession] Process exited with code ${code}`);
        this.sessions.delete(userId);
      });
    });

    this.sessions.set(userId, session);
    console.log(`[VazalSession] Session ready for user ${userId}`);
    
    return session;
  }

  /**
   * Send a prompt to an existing session and get response
   */
  async executeInSession(userId: string, prompt: string): Promise<string> {
    const session = await this.getSession(userId);
    
    return new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => {
        reject(new Error("Vazal execution timeout"));
      }, 120000); // 2 minute timeout

      const dataHandler = (data: Buffer) => {
        const text = data.toString();
        output += text;
        
        // Check for completion marker
        if (text.includes("🤖 Vazal:")) {
          clearTimeout(timeout);
          if (session.process.stdout) {
            session.process.stdout.off("data", dataHandler);
          }
          
          // Extract final answer
          const parts = output.split("🤖 Vazal:");
          const answer = parts[parts.length - 1].trim();
          resolve(answer);
        }
      };

      if (session.process.stdout) {
        session.process.stdout.on("data", dataHandler);
      }

      // Send prompt to stdin
      if (session.process.stdin) {
        session.process.stdin.write(JSON.stringify({ prompt }) + "\n");
      }
    });
  }

  /**
   * Clean up idle sessions to free resources
   */
  private cleanupIdleSessions() {
    const now = Date.now();
    
    for (const [userId, session] of Array.from(this.sessions.entries())) {
      if (now - session.lastUsed > this.IDLE_TIMEOUT) {
        console.log(`[VazalSession] Cleaning up idle session for user ${userId}`);
        session.process.kill();
        this.sessions.delete(userId);
      }
    }
  }

  /**
   * Shutdown all sessions
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [userId, session] of Array.from(this.sessions.entries())) {
      console.log(`[VazalSession] Shutting down session for user ${userId}`);
      session.process.kill();
    }

    this.sessions.clear();
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
