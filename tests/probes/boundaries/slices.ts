// as: src/ui/probe.ts

import { cookies } from 'next/headers'; // refused
import { redirect } from 'next/navigation';
import { z } from 'zod'; // refused
import { HouseCard } from '@/features/houses/ui/house-card'; // refused
import { formatMoney } from '@/kernel/money';
import { getEnv } from '@/platform/config/env'; // refused
import { helper } from '../../tests/support/session'; // refused

export const probe = [formatMoney, getEnv, HouseCard, z, redirect, cookies, helper];
