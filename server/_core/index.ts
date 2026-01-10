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

// Get Vazal base path
function getVazalPath(): string {
  return process.env.VAZAL_PATH || path.join(os.homedir(), "OpenManus");
}

// Get all possible file locations
function getFileSearchPaths(): string[] {
  const vazalPath = getVazalPath();
  return [
    path.join(vazalPath, "workspace"),      // Main workspace
    path.join(vazalPath, "output"),          // PPT and other outputs
    path.join(vazalPath, "downloads"),       // Downloaded files
    vazalPath,                               // Root OpenManus folder
  ];
}

// Find a file in any of the search paths
function findFile(filename: string): string | null {
  const searchPaths = getFileSearchPaths();
  
  for (const searchPath of searchPaths) {
    // Direct path
    const directPath = path.join(searchPath, filename);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
    
    // Search recursively (1 level deep)
    if (fs.existsSync(searchPath)) {
      try {
        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subPath = path.join(searchPath, entry.name, filename);
            if (fs.existsSync(subPath)) {
              return subPath;
            }
          }
          // Check if filename matches (case-insensitive)
          if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
            return path.join(searchPath, entry.name);
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
    }
  }
  
  return null;
}

// Get workspace for uploads
function getUploadWorkspace(): string {
  const workspace = path.join(getVazalPath(), "workspace");
  fs.mkdirSync(workspace, { recursive: true });
  return workspace;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadWorkspace());
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
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
  
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
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

  // File download endpoint - searches multiple locations
  app.get("/api/files/download/:filename", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      console.log(`[Files] User ${user.id} requesting: ${decodedFilename}`);
      
      // Find the file in any of the search paths
      const filePath = findFile(decodedFilename);
      
      if (!filePath) {
        console.log(`[Files] File not found: ${decodedFilename}`);
        console.log(`[Files] Searched in: ${getFileSearchPaths().join(', ')}`);
        res.status(404).json({ error: "File not found", searched: getFileSearchPaths() });
        return;
      }

      // Security check: ensure file is within Vazal directory
      const realPath = path.resolve(filePath);
      const vazalPath = path.resolve(getVazalPath());
      if (!realPath.startsWith(vazalPath)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      console.log(`[Files] Serving: ${filePath}`);
      res.download(filePath, decodedFilename);
    } catch (error: any) {
      console.error("[File Download Error]", error);
      res.status(500).json({ error: error.message || "Download failed" });
    }
  });

  // List all files in Vazal directories
  app.get("/api/files/list", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const allFiles: Array<{ name: string; path: string; size: number; modified: Date; location: string }> = [];
      const searchPaths = getFileSearchPaths();
      
      for (const searchPath of searchPaths) {
        if (!fs.existsSync(searchPath)) continue;
        
        try {
          const files = fs.readdirSync(searchPath);
          for (const name of files) {
            const filePath = path.join(searchPath, name);
            try {
              const stat = fs.statSync(filePath);
              if (stat.isFile()) {
                allFiles.push({
                  name,
                  path: filePath,
                  size: stat.size,
                  modified: stat.mtime,
                  location: path.basename(searchPath),
                });
              }
            } catch (e) {
              // Skip files we can't stat
            }
          }
        } catch (e) {
          // Skip directories we can't read
        }
      }

      // Sort by modified date, newest first
      allFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      res.json({ files: allFiles });
    } catch (error: any) {
      console.error("[File List Error]", error);
      res.status(500).json({ error: error.message || "Failed to list files" });
    }
  });

  // Screenshot endpoint for screen viewer
  app.get("/api/screen/screenshot", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Look for latest screenshot in browser_use or screenshots folder
      const screenshotPaths = [
        path.join(getVazalPath(), "screenshots"),
        path.join(getVazalPath(), "browser_screenshots"),
        path.join(getVazalPath(), ".browser_use", "screenshots"),
        path.join(os.tmpdir(), "vazal_screenshots"),
      ];

      let latestScreenshot: { path: string; mtime: Date } | null = null;

      for (const screenshotDir of screenshotPaths) {
        if (!fs.existsSync(screenshotDir)) continue;
        
        try {
          const files = fs.readdirSync(screenshotDir);
          for (const file of files) {
            if (!file.match(/\.(png|jpg|jpeg)$/i)) continue;
            
            const filePath = path.join(screenshotDir, file);
            const stat = fs.statSync(filePath);
            
            // Only consider screenshots from last 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (stat.mtime < fiveMinutesAgo) continue;
            
            if (!latestScreenshot || stat.mtime > latestScreenshot.mtime) {
              latestScreenshot = { path: filePath, mtime: stat.mtime };
            }
          }
        } catch (e) {
          // Skip directories we can't read
        }
      }

      if (!latestScreenshot) {
        res.status(404).json({ error: "No recent screenshot available" });
        return;
      }

      // Serve the screenshot
      const ext = path.extname(latestScreenshot.path).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(latestScreenshot.path);
    } catch (error: any) {
      console.error("[Screenshot Error]", error);
      res.status(500).json({ error: error.message || "Failed to get screenshot" });
    }
  });

  // SSE endpoint for streaming Vazal responses with activity updates
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
