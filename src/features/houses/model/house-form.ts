import { z } from 'zod';
import { CURRENCIES, type Money, toAmountMinor, toAmountText } from '@/kernel/money';
import type { House } from './house';

/**
 * The house form, field by field as the browser posts it. Native constraints in the form
 * mirror these rules; this parse is the authoritative one, and the API's own validation
 * comes back through HOUSE_API_FIELDS.
 */
const BaseFields = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(200, 'At most 200 characters'),
  description: z.string().trim().max(5000, 'At most 5000 characters').default(''),
  line1: z.string().trim().min(1, 'Enter the street address').max(200, 'At most 200 characters'),
  city: z.string().trim().min(1, 'Enter the city').max(100, 'At most 100 characters'),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Two letters, e.g. UA')
    .transform((code) => code.toUpperCase()),
  maxGuests: z
    .string()
    .min(1, 'Enter how many guests')
    .transform(Number)
    .pipe(
      z
        .number({ error: 'A whole number' })
        .int('A whole number')
        .min(1, 'At least 1')
        .max(50, 'At most 50'),
    ),
});

const CurrencyCode = z.enum(CURRENCIES as [string, ...string[]], { error: 'Choose a currency' });

const priceFits = (
  form: { price?: string | undefined; currencyCode?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (toAmountMinor(form.price ?? '', form.currencyCode ?? '') === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['price'],
      message: 'A positive amount, e.g. 120 or 120.50',
    });
  }
};

export const HouseForm = BaseFields.extend({
  currencyCode: CurrencyCode,
  price: z.string().trim().min(1, 'Enter a price per night'),
}).superRefine(priceFits);

/**
 * Editing. A house priced in a currency this form does not offer keeps its price
 * (`keepPrice`): the form shows it read-only and the update leaves it out, rather than
 * the browser falling back to the first currency and repricing the house.
 */
export const EditHouseForm = BaseFields.extend({
  id: z.uuid(),
  keepPrice: z.literal('true').optional(),
  currencyCode: z.string().optional(),
  price: z.string().trim().optional(),
}).superRefine((form, ctx) => {
  if (form.keepPrice) return;
  if (!CurrencyCode.safeParse(form.currencyCode).success) {
    ctx.addIssue({ code: 'custom', path: ['currencyCode'], message: 'Choose a currency' });
    return;
  }
  priceFits(form, ctx);
});
export const DeleteHouseForm = z.object({ id: z.uuid() });

/** Whether this form can edit a price in this currency. */
export const priceEditable = (currencyCode: string) => CURRENCIES.includes(currencyCode);

export type HouseFormField = Extract<keyof z.input<typeof HouseForm>, string>;

/** API error fields (dotted) -> form fields. */
export const HOUSE_API_FIELDS: Readonly<Record<string, HouseFormField>> = {
  title: 'title',
  description: 'description',
  'address.line1': 'line1',
  'address.city': 'city',
  'address.countryCode': 'countryCode',
  'nightlyPrice.currencyCode': 'currencyCode',
  'nightlyPrice.amountMinor': 'price',
  maxGuests: 'maxGuests',
};

function nightlyPriceOf(form: {
  price?: string | undefined;
  currencyCode?: string | undefined;
}): Money {
  const currencyCode = form.currencyCode ?? '';
  return { currencyCode, amountMinor: toAmountMinor(form.price ?? '', currencyCode) as number };
}

export function toCreateHouseBody(form: z.output<typeof HouseForm>) {
  return {
    title: form.title,
    description: form.description,
    address: { line1: form.line1, city: form.city, countryCode: form.countryCode },
    nightlyPrice: nightlyPriceOf(form),
    maxGuests: form.maxGuests,
  };
}

export function toUpdateHouseBody(form: Omit<z.output<typeof EditHouseForm>, 'id'>) {
  return {
    title: form.title,
    description: form.description,
    address: { line1: form.line1, city: form.city, countryCode: form.countryCode },
    ...(form.keepPrice ? {} : { nightlyPrice: nightlyPriceOf(form) }),
    maxGuests: form.maxGuests,
  };
}

/** The edit form's starting values. */
export function toFormValues(house: House): Record<HouseFormField, string> {
  return {
    title: house.title,
    description: house.description,
    line1: house.address.line1,
    city: house.address.city,
    countryCode: house.address.countryCode,
    currencyCode: house.nightlyPrice.currencyCode,
    price: toAmountText(house.nightlyPrice),
    maxGuests: String(house.maxGuests),
  };
}
