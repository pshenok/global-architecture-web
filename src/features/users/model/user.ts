/** A platform user as the UI shows it. */
export interface User {
  readonly id: string;
  readonly email: string | null;
  readonly fullName: string;
  readonly roles: readonly string[];
  readonly createdAt: string;
}
