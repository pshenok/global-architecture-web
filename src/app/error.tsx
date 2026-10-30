'use client';

import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { EmptyState } from '@/ui/empty-state';
import { Button } from '@/ui/primitives/button';

/**
 * Any error a page could not handle: an upstream failure, or the sign-in service being
 * unavailable while a session needed renewing. Production hides the message; the digest
 * matches the server log line.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={<TriangleAlertIcon aria-hidden="true" />}
      title="Something went wrong"
      description={`The service or the sign-in service may be unavailable. Try again in a moment.${error.digest ? ` Reference: ${error.digest}` : ''}`}
      action={
        <Button variant="outline" onClick={() => reset()}>
          <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
          Try again
        </Button>
      }
    />
  );
}
