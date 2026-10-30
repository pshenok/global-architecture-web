// as: src/features/bookings/data/probe.gateway.ts
import 'server-only';
import createClient from 'openapi-fetch'; // refused
import type { House } from '@/features/houses';
import { getHouse } from '@/features/houses/data/houses.gateway'; // refused
import { api } from '@/platform/api';
import { orInterrupt } from '@/platform/errors'; // refused
import { log } from '@/platform/observability';
import type { Caller } from '@/platform/session';
import { authorizationHeader } from '@/platform/session/caller'; // refused
import { stuff } from '../../users/model/user'; // refused
import { BookingForm } from '../model/forms';
import { MyBookingsView } from '../views/my-bookings'; // refused

export const probe = (caller: Caller, house: House) => [
  api().GET('/v1/bookings'),
  api().GET('/v1/houses/{id}'), // refused
  api().POST(path), // refused
  fetch('https://evil.test'), // refused
  getHouse,
  orInterrupt,
  log,
  authorizationHeader,
  BookingForm,
  MyBookingsView,
  stuff,
  createClient,
  caller,
  house,
];
const path = '/v1/bookings';
