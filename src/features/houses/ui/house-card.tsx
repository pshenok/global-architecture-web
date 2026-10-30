import { MapPinIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { MoneyText } from '@/ui/money-text';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/primitives/card';
import type { House } from '../model/house';

function HouseCard({ house }: { house: House }) {
  return (
    <Card className="relative transition-colors hover:bg-muted/40">
      <CardHeader>
        <CardTitle>
          <Link
            href={`/houses/${house.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {house.title}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <MapPinIcon aria-hidden="true" className="size-3.5" />
          {house.address.city}, {house.address.countryCode}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm">
        <span>
          <MoneyText value={house.nightlyPrice} />{' '}
          <span className="text-muted-foreground">/ night</span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <UsersIcon aria-hidden="true" className="size-3.5" />
          up to {house.maxGuests}
        </span>
      </CardContent>
    </Card>
  );
}

export function HouseGrid({ houses }: { houses: readonly House[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {houses.map((house) => (
        <li key={house.id}>
          <HouseCard house={house} />
        </li>
      ))}
    </ul>
  );
}
