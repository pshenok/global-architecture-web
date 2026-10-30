// as: src/features/houses/ui/probe.tsx
'use client';
import { cookies } from 'next/headers'; // refused
import { useState } from 'react';
import { requireUser } from '@/platform/session'; // refused
import { createHouse } from '../actions'; // refused
import { getHouse } from '../data/houses.gateway'; // refused
import { HouseCatalogueView } from '../views/catalogue'; // refused
import 'server-only'; // refused
import { Button } from '@/ui/primitives/button';
import type { House } from '../model/house';
import { canEdit } from '../model/house';

export async function Probe() { // refused
  return [useState, getHouse, HouseCatalogueView, createHouse, requireUser, cookies, canEdit, Button] as unknown as House;
}
