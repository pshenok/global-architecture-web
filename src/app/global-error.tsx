'use client';

/** The root layout itself failed: a bare page with no shell (and no CSS dependency). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-US">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>Try again in a moment.{error.digest ? ` Reference: ${error.digest}` : ''}</p>
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
