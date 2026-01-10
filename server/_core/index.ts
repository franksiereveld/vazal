import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { executeVazalStreaming } from "../services/vazalStreamingService";
import { createConversation, saveMessage } from "../db";
import { sdk } from "./sdk";

// Get Vazal workspace path
function getVazalWorkspace(): string {
  const vazalPath = process.env.VAZAL_PATH || path.join(os.homedir(), "OpenManus");
  return path.join(vazalPath, "workspace");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const workspace = getVazalWorkspace();
    fs.mkdirSync(workspace, { recursive: true });
    cb(null, workspace);
  },
  filename: (req, file, cb) => {
    // Keep original filename but make it safe
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure body parser with larger size limit
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback
  registerOAuthRoutes(app);

  // File upload endpoint
  app.post("/api/files/upload", upload.array('files', 10), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files uploaded" });
        return;
      }

      const fileInfos = files.map(file => ({
        name: file.originalname,
        path: file.path,
        size: file.size,
      }));

      console.log(`[Files] User ${user.id} uploaded ${files.length} file(s)`);
      res.json({ success: true, files: fileInfos });
    } catch (error: any) {
      console.error("[File Upload Error]", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // File download endpoint
  app.get("/api/files/download/:filename", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { filename } = req.params;
      const workspace = getVazalWorkspace();
      const filePath = path.join(workspace, filename);

      // Security check: ensure file is within workspace
      const realPath = path.resolve(filePath);
      const realWorkspace = path.resolve(workspace);
      if (!realPath.startsWith(realWorkspace)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      console.log(`[Files] User ${user.id} downloading: ${filename}`);
      res.download(filePath, filename);
    } catch (error: any) {
      console.error("[File Download Error]", error);
      res.status(500).json({ error: error.message || "Download failed" });
    }
  });

  // List files in workspace
  app.get("/api/files/list", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const workspace = getVazalWorkspace();
      fs.mkdirSync(workspace, { recursive: true });
      
      const files = fs.readdirSync(workspace);
      const fileInfos = files.map(name => {
        const filePath = path.join(workspace, name);
        const stat = fs.statSync(filePath);
        return {
          name,
          size: stat.size,
          modified: stat.mtime,
          isDirectory: stat.isDirectory(),
        };
      }).filter(f => !f.isDirectory);

      res.json({ files: fileInfos });
    } catch (error: any) {
      console.error("[File List Error]", error);
      res.status(500).json({ error: error.message || "Failed to list files" });
    }
  });

  // SSE endpoint for streaming Vazal responses
  app.post("/api/vazal/stream", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { prompt, conversationId: inputConversationId } = req.body;
      if (!prompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }

      let conversationId = inputConversationId;
      if (!conversationId) {
        conversationId = await createConversation(user.id, prompt.substring(0, 50));
      }

      await saveMessage(conversationId, "user", prompt);

      const result = await executeVazalStreaming(user.id, prompt, res);

      if (result) {
        await saveMessage(conversationId, "assistant", result);
      }
    } catch (error: any) {
      console.error("[Vazal Stream Error]", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Development mode uses Vite, production uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
