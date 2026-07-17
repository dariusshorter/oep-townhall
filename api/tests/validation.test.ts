import { describe, expect, it } from 'vitest';
import { escapeCsvValue, questionFingerprint, sanitizePlainText, validateQuestionText } from '../src/validation.js';

describe('question validation', () => {
  it('accepts a valid submission', () => {
    expect(validateQuestionText('What is the growth strategy?')).toEqual({
      ok: true,
      value: 'What is the growth strategy?'
    });
  });

  it('rejects blank submissions', () => {
    expect(validateQuestionText('   ').ok).toBe(false);
  });

  it('rejects too-short submissions', () => {
    expect(validateQuestionText('Why').error).toBe('too_short');
  });

  it('rejects oversized submissions', () => {
    expect(validateQuestionText('x'.repeat(2001)).error).toBe('too_long');
  });

  it('normalizes whitespace and removes control characters', () => {
    expect(sanitizePlainText('\u0000  What\r\nnow?  ')).toBe('What\nnow?');
  });

  it('does not execute or render html-like input', () => {
    expect(validateQuestionText('<script>alert(1)</script> strategy?').value).toBe('<script>alert(1)</script> strategy?');
  });

  it('detects likely duplicates by normalized text only', () => {
    expect(questionFingerprint('  What is our strategy? ')).toBe(questionFingerprint('what   is our strategy?'));
  });

  it('protects exported CSV from formula injection', () => {
    expect(escapeCsvValue('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
    expect(escapeCsvValue('+SUM(1,1)')).toBe('"\' +SUM(1,1)"'.replace("' ", "'"));
  });
});
