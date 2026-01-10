import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSMSCode, sendSMSCode } from "./_core/sms";
import { createSMSVerification, verifySMSCode, findOrCreateUserByPhone } from "./smsAuth";
import { getUserByOpenId, createConversation, getConversationsByUserId, getMessagesByConversationId, saveMessage, updateConversationTitle, deleteConversation } from "./db";
import { sdk } from "./_core/sdk";
import { executeVazalCommand, classifyIntent, generatePlan } from "./vazalService";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
        
        // Find or create user
        const userId = await findOrCreateUserByPhone(input.phone, input.name);
        
        // Get user by ID instead of openId
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
        
        // Create session
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        
        return { success: true, user };
      }),
  }),

  vazal: router({
    // Step 1: Classify intent (CHAT vs TASK)
    classify: protectedProcedure
      .input(z.object({ prompt: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await classifyIntent(input.prompt);
        return result;
      }),

    // Step 2: Generate plan for TASK
    plan: protectedProcedure
      .input(z.object({ prompt: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await generatePlan(input.prompt);
        return result;
      }),

    // Step 3: Execute task (after plan confirmation)
    execute: protectedProcedure
      .input(z.object({ 
        prompt: z.string().min(1),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Create conversation if not provided
          let conversationId = input.conversationId;
          if (!conversationId) {
            conversationId = await createConversation(ctx.user.id);
          }

          // Save user message
          await saveMessage(conversationId, "user", input.prompt);

          // Execute Vazal
          const result = await executeVazalCommand(input.prompt, ctx.user.id);

          // Save assistant response
          await saveMessage(conversationId, "assistant", result);

          // Update conversation title if it's the first message
          const messages = await getMessagesByConversationId(conversationId);
          if (messages.length <= 2) {
            const title = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
            await updateConversationTitle(conversationId, title);
          }

          return { success: true, result, conversationId };
        } catch (error: any) {
          console.error('[Vazal Router] Error:', error);
          throw new Error(error.message || "Failed to execute Vazal command");
        }
      }),

    // Quick chat response (for CHAT type, no execution needed)
    chat: protectedProcedure
      .input(z.object({ 
        prompt: z.string().min(1),
        response: z.string().min(1),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Create conversation if not provided
        let conversationId = input.conversationId;
        if (!conversationId) {
          conversationId = await createConversation(ctx.user.id);
        }

        // Save both messages
        await saveMessage(conversationId, "user", input.prompt);
        await saveMessage(conversationId, "assistant", input.response);

        // Update title
        const title = input.prompt.slice(0, 50) + (input.prompt.length > 50 ? "..." : "");
        await updateConversationTitle(conversationId, title);

        return { success: true, conversationId };
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
        // Parse files JSON
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

export type AppRouter = typeof appRouter;
