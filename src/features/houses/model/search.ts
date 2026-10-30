import { z } from 'zod';

/** The catalogue's query: an optional city and the page token. Bad values are dropped. */
export const CatalogueQuery = z.object({
  city: z.string().trim().min(1).max(100).optional().catch(undefined),
  pageToken: z.string().min(1).max(512).optional().catch(undefined),
});

export type CatalogueQuery = z.output<typeof CatalogueQuery>;

export const HouseId = z.uuid();
