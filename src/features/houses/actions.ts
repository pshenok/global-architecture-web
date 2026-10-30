'use server';

import { defineAction } from '@/platform/actions';
import * as houses from './data/houses.gateway';
import {
  DeleteHouseForm,
  EditHouseForm,
  HOUSE_API_FIELDS,
  HouseForm,
  toHouseBody,
} from './model/house-form';
import { HOUSE_MESSAGES } from './model/messages';

export const createHouse = defineAction({
  access: 'user',
  input: HouseForm,
  fields: HOUSE_API_FIELDS,
  messages: HOUSE_MESSAGES,
  run: async ({ caller }, input) => {
    const result = await houses.createHouse(caller, toHouseBody(input));
    return result.ok ? { kind: 'redirect', to: `/houses/${result.value.id}` } : result;
  },
});

export const updateHouse = defineAction({
  access: 'user',
  input: EditHouseForm,
  fields: HOUSE_API_FIELDS,
  messages: HOUSE_MESSAGES,
  run: async ({ caller }, { id, ...input }) => {
    const result = await houses.updateHouse(caller, id, toHouseBody(input));
    return result.ok ? { kind: 'redirect', to: `/houses/${id}` } : result;
  },
});

export const deleteHouse = defineAction({
  access: 'user',
  input: DeleteHouseForm,
  messages: HOUSE_MESSAGES,
  successCodes: ['HOUSE_NOT_FOUND'],
  run: async ({ caller }, { id }) => {
    const result = await houses.deleteHouse(caller, id);
    return result.ok ? { kind: 'redirect', to: '/houses/mine' } : result;
  },
});
