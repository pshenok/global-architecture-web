// as: src/features/houses/actions.ts
'use server';
import { redirect } from 'next/navigation'; // refused
import { defineAction } from '@/platform/actions';
import { api } from '@/platform/api'; // refused
import { HouseForm } from './model/house-form';

export const createHouse = defineAction({ access: 'user', input: HouseForm, run: async () => ({ kind: 'done' }) });
export const sneaky = defineAction({ access: access(), input: HouseForm, run: async () => ({ kind: 'done' }) }); // refused
export async function plain() { // refused
  return [redirect, api];
}
const access = () => 'user' as const;
export const ok = defineAction({ access: 'user', input: HouseForm, run: async () => ({ kind: 'done' }) }), raw = async () => 1; // refused
export { access }; // refused
export default createHouse; // refused
export let later = defineAction({ access: 'user', input: HouseForm, run: async () => ({ kind: 'done' }) }); // refused
export const spread = defineAction({ ...{ access: 'user' }, input: HouseForm, run: async () => ({ kind: 'done' }) }); // refused
