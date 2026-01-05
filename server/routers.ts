import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSMSCode, sendSMSCode } from "./_core/sms";
import { createSMSVerification, verifySMSCode, findOrCreateUserByPhone } from "./smsAuth";
import { getUserByOpenId } from "./db";
import { sdk } from "./_core/sdk";
import { executeVazalCommand } from "./vazalService";

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
    execute: publicProcedure
      .input(z.object({ prompt: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          const result = await executeVazalCommand(input.prompt);
          return { success: true, result };
        } catch (error: any) {
          console.error('[Vazal Router] Error:', error);
          throw new Error(error.message || "Failed to execute Vazal command");
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
