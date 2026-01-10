import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSMSCode, sendSMSCode } from "./_core/sms";
import { createSMSVerification, verifySMSCode, findOrCreateUserByPhone } from "./smsAuth";
import { getUserByOpenId, createConversation, getConversationsByUserId, getMessagesByConversationId, saveMessage, updateConversationTitle, deleteConversation } from "./db";
import { sdk } from "./_core/sdk";
import { persistentVazalManager } from "./services/persistentVazalManager";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Get Vazal workspace path for file operations
function getVazalWorkspace(): string {
  const vazalPath = process.env.VAZAL_PATH || path.join(os.homedir(), "OpenManus");
  return path.join(vazalPath, "workspace");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  sms: router({
    sendCode: publicProcedure
      .input(z.object({ phone: z.string().min(10) }))
      .mutation(async ({ input }) => {
        try {
          const code = generateSMSCode();
          await createSMSVerification(input.phone, code);
          const sent = await sendSMSCode(input.phone, code);
          
          if (!sent) {
            throw new Error("Failed to send SMS code. Check server logs for details.");
          }
          
          return { success: true };
        } catch (error: any) {
          console.error('[SMS Router] Error:', error);
          throw new Error(error.message || "Failed to send SMS code");
        }
      }),

    verifyCode: publicProcedure
      .input(z.object({ phone: z.string().min(10), code: z.string().length(6), name: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const isValid = await verifySMSCode(input.phone, input.code);
        
        if (!isValid) {
          throw new Error("Invalid or expired code");
        }
        
        const userId = await findOrCreateUserByPhone(input.phone, input.name);
        
        const db = await (await import("./db")).getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        const userResult = await db
          .select()
          .from((await import("../drizzle/schema")).users)
          .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).users.id, userId))
          .limit(1);
        
        if (userResult.length === 0) {
          throw new Error("User creation failed");
        }
        
        const user = userResult[0];
        
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        
        return { success: true, user };
      }),
  }),

  vazal: router({
    // Step 1: Classify intent (CHAT vs TASK) - uses persistent process
    classify: protectedProcedure
      .input(z.object({ prompt: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        console.log(`[Vazal] Classifying for user ${ctx.user.id}: "${input.prompt.slice(0, 50)}..."`);
        const result = await persistentVazalManager.classify(ctx.user.id, input.prompt);
        console.log(`[Vazal] Classification result:`, result);
        return result;
      }),

    // Step 2: Generate plan for TASK - uses persistent process
    plan: protectedProcedure
      .input(z.object({ prompt: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        console.log(`[Vazal] Generating plan for user ${ctx.user.id}`);
        const result = await persistentVazalManager.plan(ctx.user.id, input.prompt);
        return result;
      }),

    // Step 3: Execute task - uses persistent process
    execute: protectedProcedure
      .input(z.object({ 
        prompt: z.string().min(1),
        conversationId: z.number().optional(),
        files: z.array(z.string()).optional(), // Uploaded file paths
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          let conversationId = input.conversationId;
          if (!conversationId) {
            conversationId = await createConversation(ctx.user.id);
          }

          // Include file context in prompt if files were uploaded
          let fullPrompt = input.prompt;
          if (input.files && input.files.length > 0) {
            fullPrompt += `\n\nUser has uploaded the following files:\n${input.files.join('\n')}`;
          }

          await saveMessage(conversationId, "user", input.prompt);

          console.log(`[Vazal] Executing for user ${ctx.user.id}`);
          const result = await persistentVazalManager.execute(ctx.user.id, fullPrompt);

          // Extract any output files from the result
          const outputFiles = extractOutputFiles(result);

          await saveMessage(conversationId, "assistant", result, outputFiles);

          const messages = await getMessagesByConversationId(conversationId);
          if (messages.length <= 2) {
            const title = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
            await updateConversationTitle(conversationId, title);
          }

          return { success: true, result, conversationId, files: outputFiles };
        } catch (error: any) {
          console.error('[Vazal Router] Error:', error);
          throw new Error(error.message || "Failed to execute Vazal command");
        }
      }),

    // Quick chat response (for CHAT type)
    chat: protectedProcedure
      .input(z.object({ 
        prompt: z.string().min(1),
        response: z.string().min(1),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        let conversationId = input.conversationId;
        if (!conversationId) {
          conversationId = await createConversation(ctx.user.id);
        }

        await saveMessage(conversationId, "user", input.prompt);
        await saveMessage(conversationId, "assistant", input.response);

        const title = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
        await updateConversationTitle(conversationId, title);

        return { success: true, conversationId };
      }),

    // Get session status
    status: protectedProcedure
      .query(({ ctx }) => {
        return persistentVazalManager.getSessionStatus(ctx.user.id);
      }),
  }),

  files: router({
    // List files in workspace
    list: protectedProcedure
      .query(async () => {
        const workspace = getVazalWorkspace();
        try {
          await fs.mkdir(workspace, { recursive: true });
          const files = await fs.readdir(workspace);
          const fileInfos = await Promise.all(
            files.map(async (name) => {
              const filePath = path.join(workspace, name);
              const stat = await fs.stat(filePath);
              return {
                name,
                path: filePath,
                size: stat.size,
                modified: stat.mtime,
                isDirectory: stat.isDirectory(),
              };
            })
          );
          return fileInfos.filter(f => !f.isDirectory);
        } catch {
          return [];
        }
      }),

    // Get download URL for a file
    download: protectedProcedure
      .input(z.object({ filename: z.string() }))
      .query(async ({ input }) => {
        const workspace = getVazalWorkspace();
        const filePath = path.join(workspace, input.filename);
        
        // Security: ensure file is within workspace
        if (!filePath.startsWith(workspace)) {
          throw new Error("Invalid file path");
        }
        
        try {
          await fs.access(filePath);
          // Return the API endpoint for downloading
          return { 
            url: `/api/files/download/${encodeURIComponent(input.filename)}`,
            filename: input.filename,
          };
        } catch {
          throw new Error("File not found");
        }
      }),

    // Delete a file
    delete: protectedProcedure
      .input(z.object({ filename: z.string() }))
      .mutation(async ({ input }) => {
        const workspace = getVazalWorkspace();
        const filePath = path.join(workspace, input.filename);
        
        if (!filePath.startsWith(workspace)) {
          throw new Error("Invalid file path");
        }
        
        await fs.unlink(filePath);
        return { success: true };
      }),
  }),

  conversations: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return getConversationsByUserId(ctx.user.id);
      }),

    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        const messages = await getMessagesByConversationId(input.conversationId);
        return messages.map(msg => ({
          ...msg,
          files: msg.files ? JSON.parse(msg.files) : [],
        }));
      }),

    create: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const id = await createConversation(ctx.user.id, input.title);
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteConversation(input.conversationId, ctx.user.id);
        return { success: true };
      }),
  }),
});

// Helper to extract output file paths from Vazal response
function extractOutputFiles(result: string): string[] {
  const files: string[] = [];
  const patterns = [
    /saved (?:to|at|as) ["`']?([^\s"'`]+\.(?:pptx?|docx?|xlsx?|pdf|png|jpg|jpeg|csv|txt|md))["`']?/gi,
    /created ["`']?([^\s"'`]+\.(?:pptx?|docx?|xlsx?|pdf|png|jpg|jpeg|csv|txt|md))["`']?/gi,
    /output[:\s]+["`']?([^\s"'`]+\.(?:pptx?|docx?|xlsx?|pdf|png|jpg|jpeg|csv|txt|md))["`']?/gi,
    /file[:\s]+["`']?([^\s"'`]+\.(?:pptx?|docx?|xlsx?|pdf|png|jpg|jpeg|csv|txt|md))["`']?/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(result)) !== null) {
      const filename = path.basename(match[1]);
      if (!files.includes(filename)) {
        files.push(filename);
      }
    }
  }
  
  return files;
}

export type AppRouter = typeof appRouter;
