// as: src/features/users/views/probe.ts
import 'server-only';
import { BookingDetailView } from '@/features/bookings/server'; // refused
import { requireUser } from '@/platform/session';
import { listUsers } from '../data/users.gateway';

export const probe = [BookingDetailView, requireUser, listUsers];
