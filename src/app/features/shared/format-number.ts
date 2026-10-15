const MAXIMUM_FRACTION_DIGITS = 3;

/** A number as text in the decimal notation of the language (for example "6,25" in German), without grouping. */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, {maximumFractionDigits: MAXIMUM_FRACTION_DIGITS, useGrouping: false}).format(value);
}

const DECIMAL_PATTERN = /^-?\d+(?:[.,]\d+)?$/;

/** Text typed by the user as a number: "," or "." is the single decimal separator; blank text is `null`, anything else that is not a number is `NaN`. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  return DECIMAL_PATTERN.test(trimmed) ? Number(trimmed.replace(',', '.')) : NaN;
}
