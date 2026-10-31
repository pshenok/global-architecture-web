// as: src/features/houses/actions.ts
'use server';
import { defineAction as define } from '@/platform/actions'; // refused
import { HouseForm } from './model/house-form';

const defineAction = (spec: unknown) => spec; // refused
export const removeAnyHouse = defineAction({ access: 'admin', input: HouseForm, run: async () => ({ kind: 'done' }) });
export const probe = [define];  // refused
