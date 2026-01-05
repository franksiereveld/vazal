import { eq, and, gt } from "drizzle-orm";
import { smsVerifications, users, InsertSmsVerification } from "../drizzle/schema";
import { getDb } from "./db";

export async function createSMSVerification(phone: string, code: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(smsVerifications).values({
    phone,
    code,
    expiresAt,
    verified: 0,
  });
}

export async function verifySMSCode(phone: string, code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  
  const result = await db
    .select()
    .from(smsVerifications)
    .where(
      and(
        eq(smsVerifications.phone, phone),
        eq(smsVerifications.code, code),
        eq(smsVerifications.verified, 0),
        gt(smsVerifications.expiresAt, now)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  // Mark as verified
  await db
    .update(smsVerifications)
    .set({ verified: 1 })
    .where(eq(smsVerifications.id, result[0].id));

  return true;
}

export async function findOrCreateUserByPhone(phone: string, name?: string): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Try to find existing user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (existing.length > 0) {
    // Update last signed in
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, existing[0].id));
    
    return existing[0].id;
  }

  // Create new user with consistent openId (no timestamp so it stays the same)
  const openId = `phone_${phone}`;
  await db.insert(users).values({
    openId,
    phone,
    name: name || "",
    loginMethod: "sms",
    role: "user",
    lastSignedIn: new Date(),
  });

  // Fetch the newly created user
  const newUser = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  return newUser[0].id;
}
