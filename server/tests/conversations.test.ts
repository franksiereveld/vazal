import { describe, it, expect, beforeAll } from "vitest";
import { createConversation, getConversationsByUserId, getMessagesByConversationId, saveMessage } from "../db";

// Test user ID (use a test user that exists or will be created)
const TEST_USER_ID = 1;

describe("Conversation History", () => {
  let testConversationId: number;

  describe("createConversation", () => {
    it("should create a new conversation", async () => {
      const conversationId = await createConversation(TEST_USER_ID, "Test Conversation");
      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe("number");
      testConversationId = conversationId;
    });
  });

  describe("getConversationsByUserId", () => {
    it("should return conversations for a user", async () => {
      const conversations = await getConversationsByUserId(TEST_USER_ID);
      expect(Array.isArray(conversations)).toBe(true);
      expect(conversations.length).toBeGreaterThan(0);
      
      const lastConversation = conversations[0];
      expect(lastConversation.userId).toBe(TEST_USER_ID);
      expect(lastConversation.title).toBe("Test Conversation");
    });
  });

  describe("saveMessage", () => {
    it("should save a user message", async () => {
      await saveMessage(testConversationId, "user", "Hello, this is a test message");
      
      const messages = await getMessagesByConversationId(testConversationId);
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello, this is a test message");
    });

    it("should save an assistant message", async () => {
      await saveMessage(testConversationId, "assistant", "Hello! I'm Vazal, your AI assistant.");
      
      const messages = await getMessagesByConversationId(testConversationId);
      expect(messages.length).toBe(2);
      expect(messages[1].role).toBe("assistant");
    });
  });

  describe("getMessagesByConversationId", () => {
    it("should return messages in order", async () => {
      const messages = await getMessagesByConversationId(testConversationId);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });
  });
});
