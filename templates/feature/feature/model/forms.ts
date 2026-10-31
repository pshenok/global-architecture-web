import { z } from 'zod';
import type { ProblemCode } from '@/kernel/problem-codes';

/**
 * The form, field by field as the browser posts it. Native constraints in the form mirror
 * these rules; this parse is the authoritative one before the API's own validation.
 */
const SampleItemFields = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200, 'At most 200 characters'),
  description: z.string().trim().max(2000, 'At most 2000 characters').default(''),
});

export const SampleItemForm = SampleItemFields;
export const EditSampleItemForm = SampleItemFields.extend({ id: z.uuid() });
export const DeleteSampleItemForm = z.object({ id: z.uuid() });

export type SampleItemFormField = Extract<keyof z.input<typeof SampleItemFields>, string>;

/** API error fields (dotted) -> form fields. */
export const SAMPLE_ITEM_API_FIELDS: Readonly<Record<string, SampleItemFormField>> = {
  name: 'name',
  description: 'description',
};

/** Reason codes of the module (its domain errors) -> what the form says. */
export const SAMPLE_ITEM_MESSAGES = {
  SAMPLE_ITEM_NAME_TAKEN: { field: 'name', message: 'You already have one with this name.' },
  SAMPLE_ITEM_NOT_FOUND: 'This sample item no longer exists.',
} satisfies Partial<Record<ProblemCode, string | { field: SampleItemFormField; message: string }>>;

export const PageQuery = z.object({
  pageToken: z.string().min(1).max(512).optional().catch(undefined),
});
export const SampleItemId = z.uuid();
