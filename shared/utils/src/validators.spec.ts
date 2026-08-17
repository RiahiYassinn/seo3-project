import {
  generateSlug,
  sanitizeInput,
  validateEmail,
  validatePassword,
} from './validators';

describe('validateEmail', () => {
  it.each([
    'dev@devlab.io',
    'first.last+tag@sub.domain.co.uk',
    'a@b.c',
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each([
    ['missing @', 'devlab.io'],
    ['missing domain dot', 'dev@devlab'],
    ['whitespace in local part', 'de v@devlab.io'],
    ['empty string', ''],
    ['two @ signs', 'dev@@devlab.io'],
  ])('rejects %s', (_label, email) => {
    expect(validateEmail(email)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('rejects passwords shorter than the six character minimum', () => {
    expect(validatePassword('12345')).toBe(false);
  });

  it('accepts a password exactly at the minimum', () => {
    expect(validatePassword('123456')).toBe(true);
  });
});

describe('sanitizeInput', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('strips angle brackets so markup cannot be reconstructed', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('leaves inner whitespace and other punctuation alone', () => {
    expect(sanitizeInput(' a & b! ')).toBe('a & b!');
  });
});

describe('generateSlug', () => {
  it('lowercases and hyphenates words', () => {
    expect(generateSlug('Clean Code Basics')).toBe('clean-code-basics');
  });

  it('drops punctuation that is not a word character or hyphen', () => {
    expect(generateSlug('React: Hooks & Effects!')).toBe('react-hooks-effects');
  });

  it('collapses runs of separators into a single hyphen', () => {
    expect(generateSlug('a   b---c')).toBe('a-b-c');
  });

  it('preserves digits and underscores', () => {
    expect(generateSlug('ES_2022 Features')).toBe('es_2022-features');
  });
});
