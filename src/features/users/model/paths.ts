/** A path on this site to continue to after registration; anything else goes to the catalogue. */
export function safeLocalPath(value: string | undefined): string {
  if (
    !value?.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.length > 2048
  ) {
    return '/houses';
  }
  return value;
}
