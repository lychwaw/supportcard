// AI chatbot safety utilities — prompt injection guards and PII scrubbing.
// Import these before sending any user input to the AI or logging AI conversations.

const MAX_INPUT_LENGTH = 2000;

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:an?\s+)?(?:evil|jailbreak|dan|unfiltered|unrestricted)/i,
  /act\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?(?:an?\s+)?(?:evil|jailbreak|dan|unfiltered)/i,
  /\bsystem\s*prompt\b/i,
  /<\s*(?:system|user|assistant)\s*>/i,
  /\[INST\]|\[\/INST\]/i,
  /###\s*(?:system|instruction|prompt)/i,
];

// PII patterns with their replacements for safe logging
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{13}\b/g, replacement: '[SA-ID]' },
  { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, replacement: '[SSN]' },
  { pattern: /\b[A-Z]{2}\s?\d{6}\s?[A-Z]?\b/g, replacement: '[NI-NUMBER]' },
  { pattern: /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, replacement: '[EMAIL]' },
  { pattern: /\b\+?[1-9]\d{7,14}\b/g, replacement: '[PHONE]' },
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, replacement: '[CARD-NUMBER]' },
];

export interface AIInputSanitizeResult {
  safe: boolean;
  sanitized: string;
  reason?: string;
}

/**
 * Validates and sanitizes user input before sending to the AI.
 * Returns safe=false if the input should be rejected outright.
 */
export function sanitizeAIInput(input: string): AIInputSanitizeResult {
  if (!input || typeof input !== 'string') {
    return { safe: false, sanitized: '', reason: 'Input must be a non-empty string' };
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return { safe: false, sanitized: '', reason: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters` };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, sanitized: '', reason: 'Input contains disallowed patterns' };
    }
  }

  return { safe: true, sanitized: input.trim() };
}

/**
 * Redacts PII from a string before logging or storing AI conversation history.
 * Does NOT validate safety — call sanitizeAIInput first for user-supplied text.
 */
export function scrubPII(text: string): string {
  let scrubbed = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  return scrubbed;
}

/**
 * Rate limit key generator for AI endpoints.
 * Use with the existing checkRateLimit utility:
 *   checkRateLimit(aiRateLimitKey(userId), 10, 60_000)
 */
export function aiRateLimitKey(userId: string): string {
  return `ai:${userId}`;
}
