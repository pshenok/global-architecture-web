/** One page of a keyset-paginated list (monolith ADR-0003). */
export interface Page<T> {
  readonly items: readonly T[];
  /** Pass back as `pageToken` for the next page; null on the last page. */
  readonly nextPageToken: string | null;
}

export const PAGE_SIZE = 20;
