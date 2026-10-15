import {formatNumber, parseDecimal} from './format-number';

describe('formatNumber', () => {
  it('uses the decimal comma in German', () => {
    expect(formatNumber(6.25, 'de')).toBe('6,25');
  });

  it('uses the decimal point in English', () => {
    expect(formatNumber(6.25, 'en')).toBe('6.25');
  });

  it('shows at most 3 fraction digits', () => {
    expect(formatNumber(1.23456, 'en')).toBe('1.235');
  });

  it('does not group digits', () => {
    expect(formatNumber(1234.5, 'de')).toBe('1234,5');
  });

  it('shows no trailing zeros', () => {
    expect(formatNumber(120, 'de')).toBe('120');
    expect(formatNumber(3.5, 'de')).toBe('3,5');
    expect(formatNumber(2.5, 'en')).toBe('2.5');
  });
});

describe('parseDecimal', () => {
  it('reads a decimal comma', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
  });

  it('reads a decimal point', () => {
    expect(parseDecimal('2.5')).toBe(2.5);
  });

  it('reads an integer', () => {
    expect(parseDecimal('120')).toBe(120);
  });

  it('returns null for empty or blank text', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });

  it('returns NaN for text that is not a number', () => {
    expect(parseDecimal('2,5,1')).toBeNaN();
    expect(parseDecimal('1.000,5')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
  });
});
