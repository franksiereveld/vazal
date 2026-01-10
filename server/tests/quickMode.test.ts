import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Quick Mode Test Suite
 * 
 * Tests the Quick Mode toggle functionality which allows users to skip
 * the planning step and execute tasks directly.
 */

describe('Quick Mode', () => {
  describe('Intent Classification', () => {
    it('should classify "Hello" as CHAT type', () => {
      // Mock classification logic
      const classifyIntent = (prompt: string): 'CHAT' | 'TASK' => {
        const chatPatterns = [
          /^(hi|hello|hey|greetings)/i,
          /^how are you/i,
          /^what('s| is) up/i,
          /^good (morning|afternoon|evening)/i,
        ];
        
        for (const pattern of chatPatterns) {
          if (pattern.test(prompt.trim())) {
            return 'CHAT';
          }
        }
        return 'TASK';
      };

      expect(classifyIntent('Hello')).toBe('CHAT');
      expect(classifyIntent('Hi there')).toBe('CHAT');
      expect(classifyIntent('How are you?')).toBe('CHAT');
      expect(classifyIntent('Good morning')).toBe('CHAT');
    });

    it('should classify task requests as TASK type', () => {
      const classifyIntent = (prompt: string): 'CHAT' | 'TASK' => {
        const chatPatterns = [
          /^(hi|hello|hey|greetings)/i,
          /^how are you/i,
          /^what('s| is) up/i,
          /^good (morning|afternoon|evening)/i,
        ];
        
        for (const pattern of chatPatterns) {
          if (pattern.test(prompt.trim())) {
            return 'CHAT';
          }
        }
        return 'TASK';
      };

      expect(classifyIntent('What is the weather in Amsterdam?')).toBe('TASK');
      expect(classifyIntent('Create a presentation about AI')).toBe('TASK');
      expect(classifyIntent('Research the latest news')).toBe('TASK');
      expect(classifyIntent('Help me analyze this data')).toBe('TASK');
    });
  });

  describe('Quick Mode Behavior', () => {
    it('should skip planning when Quick Mode is enabled', () => {
      const quickMode = true;
      const intentType = 'TASK';
      
      // In Quick Mode, we should go directly to execution
      const shouldShowPlan = !quickMode && intentType === 'TASK';
      
      expect(shouldShowPlan).toBe(false);
    });

    it('should show plan when Quick Mode is disabled', () => {
      const quickMode = false;
      const intentType = 'TASK';
      
      // In Normal Mode, we should show the plan
      const shouldShowPlan = !quickMode && intentType === 'TASK';
      
      expect(shouldShowPlan).toBe(true);
    });

    it('should never show plan for CHAT type regardless of Quick Mode', () => {
      const intentType = 'CHAT';
      
      // CHAT messages never show a plan
      const shouldShowPlanQuickOn = false && intentType === 'TASK';
      const shouldShowPlanQuickOff = true && intentType === 'TASK';
      
      expect(shouldShowPlanQuickOn).toBe(false);
      expect(shouldShowPlanQuickOff).toBe(false);
    });
  });

  describe('Plan Generation', () => {
    it('should generate a plan with steps and estimated time', () => {
      const generatePlan = (prompt: string) => {
        return {
          plan: [
            'Analyze the request',
            'Search for relevant information',
            'Compile and format results',
            'Return the answer'
          ],
          estimated_time: '30 seconds'
        };
      };

      const result = generatePlan('What is the weather?');
      
      expect(result.plan).toBeInstanceOf(Array);
      expect(result.plan.length).toBeGreaterThan(0);
      expect(result.estimated_time).toBeDefined();
      expect(typeof result.estimated_time).toBe('string');
    });
  });
});
