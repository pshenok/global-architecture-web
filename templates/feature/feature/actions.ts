'use server';

import { defineAction } from '@/platform/actions';
import * as sampleItems from './data/sample-items.gateway';
import {
  DeleteSampleItemForm,
  EditSampleItemForm,
  SAMPLE_ITEM_API_FIELDS,
  SAMPLE_ITEM_MESSAGES,
  SampleItemForm,
} from './model/forms';

export const createSampleItem = defineAction({
  access: 'user',
  input: SampleItemForm,
  fields: SAMPLE_ITEM_API_FIELDS,
  messages: SAMPLE_ITEM_MESSAGES,
  run: async ({ caller }, input) => {
    const result = await sampleItems.createSampleItem(caller, input);
    return result.ok ? { kind: 'redirect', to: `/sample-items/${result.value.id}` } : result;
  },
});

export const updateSampleItem = defineAction({
  access: 'user',
  input: EditSampleItemForm,
  fields: SAMPLE_ITEM_API_FIELDS,
  messages: SAMPLE_ITEM_MESSAGES,
  run: async ({ caller }, { id, ...input }) => {
    const result = await sampleItems.updateSampleItem(caller, id, input);
    return result.ok ? { kind: 'redirect', to: `/sample-items/${id}` } : result;
  },
});

export const deleteSampleItem = defineAction({
  access: 'user',
  input: DeleteSampleItemForm,
  run: async ({ caller }, { id }) => {
    const result = await sampleItems.deleteSampleItem(caller, id);
    // Already gone (deleted in another tab): the same place as a successful delete.
    const gone = !result.ok && result.problem.code === 'SAMPLE_ITEM_NOT_FOUND';
    return result.ok || gone ? { kind: 'redirect', to: '/sample-items' } : result;
  },
});
