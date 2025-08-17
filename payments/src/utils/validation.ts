import { isValidEmail, isValidPhone, isValidAmount } from './helpers';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateField = (value: any, rules: ValidationRule): ValidationResult => {
  const errors: string[] = [];

  if (rules.required && (!value || value.toString().trim() === '')) {
    errors.push('This field is required');
  }

  if (value && rules.minLength && value.toString().length < rules.minLength) {
    errors.push(`Minimum length is ${rules.minLength} characters`);
  }

  if (value && rules.maxLength && value.toString().length > rules.maxLength) {
    errors.push(`Maximum length is ${rules.maxLength} characters`);
  }

  if (value && rules.pattern && !rules.pattern.test(value.toString())) {
    errors.push('Invalid format');
  }

  if (value && rules.custom) {
    const customResult = rules.custom(value);
    if (typeof customResult === 'string') {
      errors.push(customResult);
    } else if (!customResult) {
      errors.push('Invalid value');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Predefined validation rules
export const VALIDATION_RULES = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 50,
    // Allow both username and email formats
    custom: (value: string) => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernamePattern = /^[a-zA-Z0-9_]+$/;
      return (emailPattern.test(value) || usernamePattern.test(value)) || 'Invalid username or email format';
    }
  },
  password: {
    required: true,
    minLength: 6,
    maxLength: 50
  },
  email: {
    required: true,
    custom: (value: string) => isValidEmail(value) || 'Invalid email format'
  },
  phone: {
    required: true,
    custom: (value: string) => isValidPhone(value) || 'Invalid phone number'
  },
  amount: {
    required: true,
    custom: (value: string | number) => isValidAmount(value) || 'Amount must be greater than 0'
  },
  companyName: {
    required: true,
    minLength: 2,
    maxLength: 100
  },
  billNumber: {
    required: true,
    minLength: 1,
    maxLength: 50
  },
  comments: {
    maxLength: 500
  }
} as const;

// Form validation
export const validateForm = (data: Record<string, any>, rules: Record<string, ValidationRule>): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {};

  Object.keys(rules).forEach(field => {
    results[field] = validateField(data[field], rules[field]);
  });

  return results;
};

export const isFormValid = (validationResults: Record<string, ValidationResult>): boolean => {
  return Object.values(validationResults).every(result => result.isValid);
};

export const getFormErrors = (validationResults: Record<string, ValidationResult>): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  Object.entries(validationResults).forEach(([field, result]) => {
    if (!result.isValid) {
      errors[field] = result.errors;
    }
  });

  return errors;
};
