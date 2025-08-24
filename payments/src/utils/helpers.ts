import { DATE_FORMATS } from './constants';

// Date helpers
export const formatDate = (date: string | Date, format: string = DATE_FORMATS.DISPLAY): string => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  switch (format) {
    case DATE_FORMATS.DISPLAY:
      return `${day}/${month}/${year}`;
    case DATE_FORMATS.API:
      return `${year}-${month}-${day}`;
    case DATE_FORMATS.DATETIME:
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    default:
      return `${day}/${month}/${year}`;
  }
};

export const isDateOverdue = (date: string): boolean => {
  const today = new Date();
  const targetDate = new Date(date);
  return targetDate < today;
};

export const daysBetween = (date1: string | Date, date2: string | Date): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Currency helpers
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const parseCurrency = (currencyString: string): number => {
  return parseFloat(currencyString.replace(/[^\d.-]/g, ''));
};

// String helpers
export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Array helpers
export const sortByDate = <T>(array: T[], dateKey: keyof T, ascending: boolean = false): T[] => {
  return [...array].sort((a, b) => {
    const dateA = new Date(a[dateKey] as string).getTime();
    const dateB = new Date(b[dateKey] as string).getTime();
    return ascending ? dateA - dateB : dateB - dateA;
  });
};

export const sortByAmount = <T>(array: T[], amountKey: keyof T, ascending: boolean = false): T[] => {
  return [...array].sort((a, b) => {
    const amountA = a[amountKey] as number;
    const amountB = b[amountKey] as number;
    return ascending ? amountA - amountB : amountB - amountA;
  });
};

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

export const isValidAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0;
};

// Error handling
export const getErrorMessage = (error: any): string => {
  // Prefer backend-provided fields
  const fromData = error?.response?.data;
  if (fromData) {
    if (typeof fromData.detail === 'string') return fromData.detail;
    if (typeof fromData.message === 'string') return fromData.message;
    if (typeof fromData.error === 'string') return fromData.error;
    if (Array.isArray(fromData.errors) && fromData.errors.length > 0) {
      const first = fromData.errors[0];
      if (typeof first === 'string') return first;
      if (first?.message) return first.message;
    }
  }

  // String error
  if (typeof error === 'string') return sanitizeHttpMessage(error);

  // Standard Error
  if (error?.message) return sanitizeHttpMessage(error.message);

  return 'Something went wrong. Please try again.';
};

// Remove noisy status codes like "HTTP 401: Unauthorized"
const sanitizeHttpMessage = (msg: string): string => {
  if (!msg) return 'Something went wrong. Please try again.';
  // Strip leading "HTTP 4xx/5xx: ..." prefix
  const cleaned = msg.replace(/^HTTP\s+\d{3}[^:]*:\s*/i, '').trim();
  // Common fallbacks
  if (/unauthorized/i.test(cleaned) || /forbidden/i.test(cleaned)) return 'You don\'t have permission to perform this action.';
  if (/not found/i.test(cleaned)) return 'Requested resource was not found.';
  if (/timeout/i.test(cleaned)) return 'The request timed out. Please try again.';
  return cleaned || 'Something went wrong. Please try again.';
};

// Storage helpers
export const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
};

export const safeJsonStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
};
