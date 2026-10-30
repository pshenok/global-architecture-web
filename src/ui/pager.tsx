import { ChevronRightIcon } from 'lucide-react';
import { LinkButton } from '@/ui/link-button';

/**
 * Forward-only keyset paging (the API's nextPageToken): "First page" once past it, and
 * "Next" while there is more. Links keep the other query parameters.
 */
export function Pager({
  path,
  query,
  nextPageToken,
  onFirstPage,
}: {
  path: string;
  query: Readonly<Record<string, string | undefined>>;
  nextPageToken: string | null;
  onFirstPage: boolean;
}) {
  const href = (pageToken?: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value && key !== 'pageToken') params.set(key, value);
    if (pageToken) params.set('pageToken', pageToken);
    const search = params.toString();
    return `${path}${search ? `?${search}` : ''}`;
  };
  if (onFirstPage && !nextPageToken) return null;
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between">
      {onFirstPage ? (
        <span />
      ) : (
        <LinkButton variant="ghost" href={href() as never}>
          First page
        </LinkButton>
      )}
      {nextPageToken ? (
        <LinkButton variant="outline" href={href(nextPageToken) as never}>
          Next
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </LinkButton>
      ) : null}
    </nav>
  );
}
