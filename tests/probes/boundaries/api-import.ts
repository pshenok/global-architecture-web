// as: src/features/bookings/data/probe-import.gateway.ts
import 'server-only';
import { api as client } from '@/platform/api'; // refused
import * as platformApi from '@/platform/api'; // refused

export const probe = [client, platformApi];
