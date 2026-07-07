/**
 * Global ID Number Validation Utility
 * 
 * This utility provides functions to validate various international ID numbers,
 * extract personal information, and determine age for role assignment.
 * Supports South African, US SSN, UK National Insurance, and other formats.
 */

export interface IDValidationResult {
  isValid: boolean;
  age?: number;
  gender?: 'male' | 'female' | 'unknown';
  dateOfBirth?: string;
  country?: string;
  idType?: string;
  error?: string;
}

export interface CountryConfig {
  name: string;
  code: string;
  idFormat: string;
  minLength: number;
  maxLength: number;
  pattern: RegExp;
  ageCalculation: (id: string) => { age: number; dateOfBirth: string; gender?: 'male' | 'female' };
  validateChecksum?: (id: string) => boolean;
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  'ZA': {
    name: 'South Africa',
    code: 'ZA',
    idFormat: 'YYMMDDGGGGSCAZ',
    minLength: 13,
    maxLength: 13,
    pattern: /^\d{13}$/,
    validateChecksum: (id: string) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        let digit = parseInt(id[i], 10);
        if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
        sum += digit;
      }
      return (10 - (sum % 10)) % 10 === parseInt(id[12], 10);
    },
    ageCalculation: (id: string) => {
      const year = parseInt(id.substring(0, 2));
      const month = parseInt(id.substring(2, 4));
      const day = parseInt(id.substring(4, 6));
      const gender = parseInt(id.substring(6, 10));
      
      const fullYear = year <= 21 ? 2000 + year : 1900 + year;
      const dateOfBirth = new Date(fullYear, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - fullYear;
      const monthDiff = today.getMonth() - (month - 1);
      const dayDiff = today.getDate() - day;
      
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }
      
      return {
        age,
        dateOfBirth: dateOfBirth.toISOString().split('T')[0],
        gender: gender % 2 === 0 ? 'female' : 'male'
      };
    }
  },
  'US': {
    name: 'United States',
    code: 'US',
    idFormat: 'XXX-XX-XXXX',
    minLength: 9,
    maxLength: 11,
    pattern: /^\d{3}-?\d{2}-?\d{4}$/,
    ageCalculation: (id: string) => {
      // US SSN doesn't contain birth date, so we can't calculate age
      return { age: 0, dateOfBirth: '', gender: 'unknown' };
    }
  },
  'UK': {
    name: 'United Kingdom',
    code: 'UK',
    idFormat: 'QQ 123456 A',
    minLength: 8,
    maxLength: 9,
    pattern: /^[A-Z]{2}\s?\d{6}\s?[A-Z]?$/,
    ageCalculation: (id: string) => {
      // UK NI doesn't contain birth date, so we can't calculate age
      return { age: 0, dateOfBirth: '', gender: 'unknown' };
    }
  },
  'CA': {
    name: 'Canada',
    code: 'CA',
    idFormat: '123-456-789',
    minLength: 9,
    maxLength: 11,
    pattern: /^\d{3}-?\d{3}-?\d{3}$/,
    ageCalculation: (id: string) => {
      // Canadian SIN doesn't contain birth date, so we can't calculate age
      return { age: 0, dateOfBirth: '', gender: 'unknown' };
    }
  },
  'AU': {
    name: 'Australia',
    code: 'AU',
    idFormat: '123 456 789',
    minLength: 9,
    maxLength: 11,
    pattern: /^\d{3}\s?\d{3}\s?\d{3}$/,
    ageCalculation: (id: string) => {
      // Australian TFN doesn't contain birth date, so we can't calculate age
      return { age: 0, dateOfBirth: '', gender: 'unknown' };
    }
  },
  'DE': {
    name: 'Germany',
    code: 'DE',
    idFormat: '12345678901',
    minLength: 11,
    maxLength: 11,
    pattern: /^\d{11}$/,
    ageCalculation: (id: string) => {
      // German ID contains birth date in YYMMDD format
      const year = parseInt(id.substring(0, 2));
      const month = parseInt(id.substring(2, 4));
      const day = parseInt(id.substring(4, 6));
      
      const fullYear = year <= 21 ? 2000 + year : 1900 + year;
      const dateOfBirth = new Date(fullYear, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - fullYear;
      const monthDiff = today.getMonth() - (month - 1);
      const dayDiff = today.getDate() - day;
      
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }
      
      return {
        age,
        dateOfBirth: dateOfBirth.toISOString().split('T')[0],
        gender: 'unknown'
      };
    }
  }
};

/**
 * Detects the country and ID type from an ID number
 * @param idNumber - The ID number to analyze
 * @returns Country code and ID type, or null if not recognized
 */
export function detectIDType(idNumber: string): { country: string; idType: string } | null {
  const cleanID = idNumber.replace(/\D/g, '');
  
  for (const [code, config] of Object.entries(COUNTRY_CONFIGS)) {
    if (config.pattern.test(idNumber)) {
      return {
        country: code,
        idType: config.name
      };
    }
  }
  
  return null;
}

/**
 * Validates an ID number from any supported country
 * @param idNumber - The ID number to validate
 * @param countryCode - Optional country code to force validation for specific country
 * @returns IDValidationResult with validation status and extracted data
 */
export function validateGlobalID(idNumber: string, countryCode?: string): IDValidationResult {
  if (!idNumber || idNumber.trim() === '') {
    return {
      isValid: false,
      error: 'ID number is required'
    };
  }

  const detected = detectIDType(idNumber);
  const targetCountry = countryCode || detected?.country;
  
  if (!targetCountry || !COUNTRY_CONFIGS[targetCountry]) {
    return {
      isValid: false,
      error: 'Unsupported ID number format. Supported countries: South Africa, US, UK, Canada, Australia, Germany'
    };
  }

  const config = COUNTRY_CONFIGS[targetCountry];
  
  // Check if it matches the pattern
  if (!config.pattern.test(idNumber)) {
    return {
      isValid: false,
      error: `Invalid ${config.name} ID number format. Expected format: ${config.idFormat}`
    };
  }

  // Checksum validation (e.g. Luhn for SA IDs)
  if (config.validateChecksum && !config.validateChecksum(idNumber)) {
    return {
      isValid: false,
      error: `Invalid ${config.name} ID number (checksum failed)`
    };
  }

  // For countries where we can extract age/date of birth
  if (config.ageCalculation) {
    try {
      const { age, dateOfBirth, gender } = config.ageCalculation(idNumber);
      
      // Validate date if we have one
      if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        if (dob > new Date()) {
          return {
            isValid: false,
            error: 'Date of birth cannot be in the future'
          };
        }
      }
      
      return {
        isValid: true,
        age: age > 0 ? age : undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
        country: config.name,
        idType: config.name
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Error processing ${config.name} ID number: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // For countries where we can't extract age (like US SSN)
  return {
    isValid: true,
    country: config.name,
    idType: config.name,
    error: 'Age cannot be determined from this ID type'
  };
}

/**
 * Validates a South African ID number (backward compatibility)
 * @param idNumber - The ID number to validate
 * @returns IDValidationResult with validation status and extracted data
 */
export function validateSouthAfricanID(idNumber: string): IDValidationResult {
  return validateGlobalID(idNumber, 'ZA');
}

/**
 * Checks if a person is a minor (under 18)
 * @param age - The person's age
 * @returns boolean indicating if the person is a minor
 */
export function isMinor(age: number): boolean {
  return age < 18;
}

/**
 * Formats an ID number for display based on country
 * @param idNumber - The ID number to format
 * @param countryCode - Optional country code for formatting
 * @returns Formatted ID number
 */
export function formatIDNumber(idNumber: string, countryCode?: string): string {
  const detected = detectIDType(idNumber);
  const targetCountry = countryCode || detected?.country;
  
  if (!targetCountry || !COUNTRY_CONFIGS[targetCountry]) {
    return idNumber;
  }

  const cleanID = idNumber.replace(/\D/g, '');
  
  switch (targetCountry) {
    case 'ZA':
      if (cleanID.length === 13) {
        return `${cleanID.substring(0, 6)} ${cleanID.substring(6, 10)} ${cleanID.substring(10, 13)}`;
      }
      break;
    case 'US':
      if (cleanID.length === 9) {
        return `${cleanID.substring(0, 3)}-${cleanID.substring(3, 5)}-${cleanID.substring(5, 9)}`;
      }
      break;
    case 'UK':
      return idNumber.toUpperCase();
    case 'CA':
      if (cleanID.length === 9) {
        return `${cleanID.substring(0, 3)}-${cleanID.substring(3, 6)}-${cleanID.substring(6, 9)}`;
      }
      break;
    case 'AU':
      if (cleanID.length === 9) {
        return `${cleanID.substring(0, 3)} ${cleanID.substring(3, 6)} ${cleanID.substring(6, 9)}`;
      }
      break;
    case 'DE':
      if (cleanID.length === 11) {
        return `${cleanID.substring(0, 3)} ${cleanID.substring(3, 6)} ${cleanID.substring(6, 11)}`;
      }
      break;
  }
  
  return idNumber;
}

/**
 * Gets list of supported countries
 * @returns Array of supported country configurations
 */
export function getSupportedCountries(): Array<{ code: string; name: string; format: string }> {
  return Object.values(COUNTRY_CONFIGS).map(config => ({
    code: config.code,
    name: config.name,
    format: config.idFormat
  }));
}