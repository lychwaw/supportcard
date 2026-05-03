// Security utilities for input validation and sanitization

// XSS Protection
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

// NOTE: Supabase uses parameterised PostgREST queries — raw SQL is never constructed
// from user input in this app. Do not use string-based sanitizers for SQL; they create
// false confidence. Use the Supabase client API exclusively.

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  return {
    isValid: score >= 4,
    score,
    feedback,
  };
};

// Rate limiting (client-side)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60000 // 1 minute
): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
};

// CSRF token generation
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Input validation for different field types
export const validateInput = (type: string, value: string): {
  isValid: boolean;
  error?: string;
} => {
  switch (type) {
    case 'email':
      return {
        isValid: isValidEmail(value),
        error: isValidEmail(value) ? undefined : 'Invalid email format',
      };

    case 'password':
      const passwordValidation = validatePasswordStrength(value);
      return {
        isValid: passwordValidation.isValid,
        error: passwordValidation.isValid ? undefined : passwordValidation.feedback[0],
      };

    case 'phone':
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return {
        isValid: phoneRegex.test(value.replace(/\s/g, '')),
        error: phoneRegex.test(value.replace(/\s/g, '')) ? undefined : 'Invalid phone number',
      };

    case 'amount':
      const amount = parseFloat(value);
      return {
        isValid: !isNaN(amount) && amount > 0,
        error: !isNaN(amount) && amount > 0 ? undefined : 'Invalid amount',
      };

    default:
      return {
        isValid: value.length > 0,
        error: value.length > 0 ? undefined : 'This field is required',
      };
  }
};

// localStorage wrapper — note: base64 is NOT encryption.
// Do not store passwords, tokens, or secrets here.
// Supabase sessions are already managed securely by the Supabase client.
export const localStore = {
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, btoa(encodeURIComponent(value)));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },

  getItem: (key: string): string | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return decodeURIComponent(atob(raw));
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },
};

/**
 * Generate a SHA-256 hash for short secrets such as local passcodes.
 * Returns the hex-encoded digest so it can be safely stored in Supabase.
 */
export const hashString = async (value: string): Promise<string> => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Secure hashing is not available in this environment');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Timing-safe string compare for hashed values.
 */
export const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

