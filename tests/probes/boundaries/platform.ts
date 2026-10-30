// as: src/platform/api/probe.ts
import 'server-only';
import { SignJWT } from 'jose'; // refused
import { HouseCard } from '@/features/houses/ui/house-card'; // refused
import { getEnv } from '@/platform/config/env';
import { Button } from '@/ui/primitives/button'; // refused
import { log } from '../observability/log';

export const probe = [HouseCard, log, getEnv, Button, SignJWT];
