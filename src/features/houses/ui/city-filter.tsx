import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';

/** A GET form: the filter lives in the URL, so it can be shared and works without JS. */
export function CityFilter({ city }: { city: string | undefined }) {
  return (
    <Form action="/houses" className="flex max-w-sm items-center gap-2" role="search">
      <label htmlFor="city-filter" className="sr-only">
        City
      </label>
      <Input
        id="city-filter"
        name="city"
        placeholder="Filter by city"
        defaultValue={city ?? ''}
        maxLength={100}
      />
      <Button type="submit" variant="outline">
        <SearchIcon aria-hidden="true" data-icon="inline-start" />
        Search
      </Button>
    </Form>
  );
}
