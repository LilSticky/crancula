const MAXIMUM_FRACTION_DIGITS = 3;

/** A number as text in the decimal notation of the language (for example "6,25" in German), without grouping. */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, {maximumFractionDigits: MAXIMUM_FRACTION_DIGITS, useGrouping: false}).format(value);
}
