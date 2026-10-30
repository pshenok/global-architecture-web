import { describe, expect, it } from 'vitest';
import { formatMoney, toAmountMinor, toAmountText } from './money';

describe('money', () => {
  it('formats minor units with the ISO 4217 exponent, never through floats', () => {
    expect(formatMoney({ currencyCode: 'USD', amountMinor: 12550 }, 'en-US')).toBe('$125.50');
    expect(formatMoney({ currencyCode: 'USD', amountMinor: 5 }, 'en-US')).toBe('$0.05');
    expect(formatMoney({ currencyCode: 'JPY', amountMinor: 1200 }, 'en-US')).toBe('¥1,200');
    expect(formatMoney({ currencyCode: 'USD', amountMinor: 900719925474099 }, 'en-US')).toBe(
      '$9,007,199,254,740.99',
    );
  });

  it('shows an unknown currency as raw minor units instead of guessing', () => {
    expect(formatMoney({ currencyCode: 'XTS', amountMinor: 10 }, 'en-US')).toBe(
      '10 XTS (minor units)',
    );
  });

  it('parses typed amounts into minor units', () => {
    expect(toAmountMinor('125', 'USD')).toBe(12500);
    expect(toAmountMinor(' 125.5 ', 'USD')).toBe(12550);
    expect(toAmountMinor('0.10', 'USD')).toBe(10);
    expect(toAmountMinor('1200', 'JPY')).toBe(1200);
  });

  it('refuses amounts that are not positive or carry too many decimals', () => {
    for (const text of ['', '0', '0.00', '-1', '1.234', '1e3', '1,5', 'abc', '12.']) {
      expect(toAmountMinor(text, 'USD'), text).toBeUndefined();
    }
    expect(toAmountMinor('1.5', 'JPY')).toBeUndefined();
    expect(toAmountMinor('1', 'XTS')).toBeUndefined();
  });

  it('round-trips a form default', () => {
    expect(toAmountText({ currencyCode: 'USD', amountMinor: 12050 })).toBe('120.50');
    expect(toAmountMinor(toAmountText({ currencyCode: 'USD', amountMinor: 7 }), 'USD')).toBe(7);
  });
});
