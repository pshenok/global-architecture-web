import { DEFAULT_LOCALE } from '@/kernel/locale';
import { formatMoney, type Money } from '@/kernel/money';

export function MoneyText({ value, locale = DEFAULT_LOCALE }: { value: Money; locale?: string }) {
  return <span className="tabular-nums">{formatMoney(value, locale)}</span>;
}
