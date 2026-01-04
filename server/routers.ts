import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateSMSCode, sendSMSCode } from "./_core/sms";
import { createSMSVerification, verifySMSCode, findOrCreateUserByPhone } from "./smsAuth";
import { getUserByOpenId } from "./db";
import { sdk } from "./_core/sdk";

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
        const code = generateSMSCode();
        await createSMSVerification(input.phone, code);
        const sent = await sendSMSCode(input.phone, code);
        
        if (!sent) {
          throw new Error("Failed to send SMS code");
        }
        
        return { success: true };
      }),

    verifyCode: publicProcedure
      .input(z.object({ phone: z.string().min(10), code: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const isValid = await verifySMSCode(input.phone, input.code);
        
        if (!isValid) {
          throw new Error("Invalid or expired code");
        }
        
        // Find or create user
        const userId = await findOrCreateUserByPhone(input.phone);
        const user = await getUserByOpenId(`phone_${input.phone}_${userId}`);
        
        if (!user) {
          throw new Error("User creation failed");
        }
        
        // Create session
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        
        return { success: true, user };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
