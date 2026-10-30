// as: src/kernel/probe.ts

import { z } from 'zod'; // refused
import { Button } from '@/ui/primitives/button'; // refused
import { addDays } from './dates';

export const probe = [addDays, z, Button];
