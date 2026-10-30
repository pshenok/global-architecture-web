import { z } from 'zod';
import { CURRENCIES, type Money, toAmountMinor, toAmountText } from '@/kernel/money';
import type { House } from './house';

/**
 * The house form, field by field as the browser posts it. Native constraints in the form
 * mirror these rules; this parse is the authoritative one, and the API's own validation
 * comes back through HOUSE_API_FIELDS.
 */
const HouseFields = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(200, 'At most 200 characters'),
  description: z.string().trim().max(5000, 'At most 5000 characters').default(''),
  line1: z.string().trim().min(1, 'Enter the street address').max(200, 'At most 200 characters'),
  city: z.string().trim().min(1, 'Enter the city').max(100, 'At most 100 characters'),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Two letters, e.g. UA')
    .transform((code) => code.toUpperCase()),
  currencyCode: z.enum(CURRENCIES as [string, ...string[]], { error: 'Choose a currency' }),
  price: z.string().trim().min(1, 'Enter a price per night'),
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

const priceFits = (form: { price: string; currencyCode: string }, ctx: z.RefinementCtx) => {
  if (toAmountMinor(form.price, form.currencyCode) === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['price'],
      message: 'A positive amount, e.g. 120 or 120.50',
    });
  }
};

export const HouseForm = HouseFields.superRefine(priceFits);
export const EditHouseForm = HouseFields.extend({ id: z.uuid() }).superRefine(priceFits);
export const DeleteHouseForm = z.object({ id: z.uuid() });

export type HouseFormInput = z.input<typeof HouseForm>;
export type HouseFormField = Extract<keyof HouseFormInput, string>;

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

export function toHouseBody(form: z.output<typeof HouseFields>) {
  const nightlyPrice: Money = {
    currencyCode: form.currencyCode,
    amountMinor: toAmountMinor(form.price, form.currencyCode) as number,
  };
  return {
    title: form.title,
    description: form.description,
    address: { line1: form.line1, city: form.city, countryCode: form.countryCode },
    nightlyPrice,
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
