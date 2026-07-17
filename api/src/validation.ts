import { createHash } from 'node:crypto';

export interface ValidationResult {
  ok: boolean;
  value?: string;
  error?: 'required' | 'too_short' | 'too_long';
}

export function sanitizePlainText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export function normalizeForFingerprint(value: string): string {
  return sanitizePlainText(value).toLowerCase().replace(/\s+/g, ' ');
}

export function questionFingerprint(value: string): string {
  return createHash('sha256').update(normalizeForFingerprint(value), 'utf8').digest('hex');
}

export function validateQuestionText(value: unknown, maxLength = 2000): ValidationResult {
  if (typeof value !== 'string') {
    return { ok: false, error: 'required' };
  }

  const sanitized = sanitizePlainText(value);
  if (!sanitized) {
    return { ok: false, error: 'required' };
  }
  if (sanitized.length < 5) {
    return { ok: false, error: 'too_short' };
  }
  if (sanitized.length > maxLength) {
    return { ok: false, error: 'too_long' };
  }
  return { ok: true, value: sanitized };
}

export function escapeCsvValue(value: unknown): string {
  const text = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const formulaSafe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}
