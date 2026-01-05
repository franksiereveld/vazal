/**
 * Detect if a prompt is a simple question that can be answered by chat
 * vs a complex task that requires the full agent
 */
export function isSimpleQuestion(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim();
  
  // Greetings and casual chat
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
  if (greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + ','))) {
    return true;
  }
  
  // Simple math questions
  if (/what (is|are|does|do) \d+[\+\-\*\/×÷]\d+/.test(lower)) {
    return true;
  }
  
  // Definition questions (short answers)
  if (lower.startsWith('what is ') || lower.startsWith('what are ') || 
      lower.startsWith('who is ') || lower.startsWith('who are ') ||
      lower.startsWith('define ') || lower.startsWith('explain ')) {
    // But exclude complex requests
    if (lower.includes('create') || lower.includes('make') || 
        lower.includes('build') || lower.includes('generate') ||
        lower.includes('find') || lower.includes('search') ||
        lower.includes('download') || lower.includes('get me')) {
      return false;
    }
    return true;
  }
  
  // Questions that clearly need agent actions
  const agentKeywords = [
    'create', 'make', 'build', 'generate', 'write',
    'find', 'search', 'look up', 'research',
    'download', 'get me', 'fetch',
    'book', 'schedule', 'order', 'buy',
    'send', 'email', 'message',
    'analyze', 'compare', 'summarize',
    'slides', 'presentation', 'document', 'report'
  ];
  
  if (agentKeywords.some(kw => lower.includes(kw))) {
    return false; // Needs full agent
  }
  
  // Short questions (< 20 words) without action verbs are probably simple
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 20 && !lower.includes('?')) {
    return false; // Statements might need context
  }
  
  // Default: if it's a question and short, treat as simple
  return lower.includes('?') && wordCount < 20;
}
