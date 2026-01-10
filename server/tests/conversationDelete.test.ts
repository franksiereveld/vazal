import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, createConversation, saveMessage, getConversationsByUserId, getMessagesByConversationId, deleteConversation } from '../db';

/**
 * Conversation Deletion Test Suite
 * 
 * Tests the conversation deletion functionality including:
 * - Deleting conversations and their messages
 * - Access control (users can only delete their own conversations)
 */

describe('Conversation Deletion', () => {
  let testUserId: number;
  let testConversationId: number;

  beforeEach(async () => {
    // Create a test user ID (in real app this would come from auth)
    testUserId = 999;
    
    // Create a test conversation
    testConversationId = await createConversation(testUserId, 'Test Conversation for Deletion');
    
    // Add some messages
    await saveMessage(testConversationId, 'user', 'Hello');
    await saveMessage(testConversationId, 'assistant', 'Hi there!');
  });

  afterEach(async () => {
    // Clean up - try to delete if still exists
    try {
      await deleteConversation(testConversationId, testUserId);
    } catch {
      // Already deleted, ignore
    }
  });

  it('should delete a conversation and its messages', async () => {
    // Verify conversation exists
    const conversationsBefore = await getConversationsByUserId(testUserId);
    const existsBefore = conversationsBefore.some(c => c.id === testConversationId);
    expect(existsBefore).toBe(true);

    // Verify messages exist
    const messagesBefore = await getMessagesByConversationId(testConversationId);
    expect(messagesBefore.length).toBe(2);

    // Delete the conversation
    await deleteConversation(testConversationId, testUserId);

    // Verify conversation is gone
    const conversationsAfter = await getConversationsByUserId(testUserId);
    const existsAfter = conversationsAfter.some(c => c.id === testConversationId);
    expect(existsAfter).toBe(false);

    // Verify messages are gone
    const messagesAfter = await getMessagesByConversationId(testConversationId);
    expect(messagesAfter.length).toBe(0);
  });

  it('should reject deletion of conversation by wrong user', async () => {
    const wrongUserId = 888;
    
    // Attempt to delete with wrong user ID should throw
    await expect(
      deleteConversation(testConversationId, wrongUserId)
    ).rejects.toThrow('Conversation not found or access denied');
  });

  it('should reject deletion of non-existent conversation', async () => {
    const nonExistentId = 999999;
    
    await expect(
      deleteConversation(nonExistentId, testUserId)
    ).rejects.toThrow('Conversation not found or access denied');
  });
});
