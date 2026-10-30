/**
 * Money in minor units, as the API sends it. Formatting uses an explicit ISO 4217
 * exponent table and integer string math: never floats, never Intl's CLDR exponents
 * (which differ from ISO 4217 for some currencies).
 */
export interface Money {
  readonly currencyCode: string;
  readonly amountMinor: number;
}

const EXPONENTS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  UAH: 2,
  PLN: 2,
  CHF: 2,
  CAD: 2,
  JPY: 0,
};

/** Currencies the forms offer (all with a known exponent). */
export const CURRENCIES = Object.keys(EXPONENTS);

function currencyExponent(currencyCode: string): number | undefined {
  return EXPONENTS[currencyCode];
}

/** "125.50"-style major units for a known currency. */
function majorUnits(amountMinor: number, exponent: number): string {
  const digits = String(Math.abs(amountMinor)).padStart(exponent + 1, '0');
  const sign = amountMinor < 0 ? '-' : '';
  if (exponent === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

export function formatMoney(money: Money, locale: string): string {
  const exponent = currencyExponent(money.currencyCode);
  if (exponent === undefined || !Number.isSafeInteger(money.amountMinor)) {
    return `${money.amountMinor} ${money.currencyCode} (minor units)`;
  }
  const major = majorUnits(money.amountMinor, exponent);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currencyCode,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(major as `${number}`);
}

/**
 * Parses what a person typed ("125", "125.5", "125.50") into minor units. Undefined when
 * it is not a positive amount with at most the currency's number of decimals.
 */
export function toAmountMinor(text: string, currencyCode: string): number | undefined {
  const exponent = currencyExponent(currencyCode);
  if (exponent === undefined) return undefined;
  const match = /^(\d{1,13})(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return undefined;
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > exponent) return undefined;
  const minor = Number(`${whole}${fraction.padEnd(exponent, '0')}`);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : undefined;
}

/** The inverse of toAmountMinor, for a form's default value. */
export function toAmountText(money: Money): string {
  const exponent = currencyExponent(money.currencyCode);
  return exponent === undefined
    ? String(money.amountMinor)
    : majorUnits(money.amountMinor, exponent);
}
