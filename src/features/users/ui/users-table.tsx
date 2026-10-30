import type { Route } from 'next';
import Link from 'next/link';
import { formatInstant } from '@/kernel/dates';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import { Badge } from '@/ui/primitives/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/primitives/table';
import type { User } from '../model/user';

export function UsersTable({ users }: { users: readonly User[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={`/admin/users/${user.id}` as Route}
              >
                {user.fullName}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{user.email ?? 'none'}</TableCell>
            <TableCell>
              {user.roles.length === 0 ? (
                <span className="text-muted-foreground">user</span>
              ) : (
                user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatInstant(user.createdAt, DEFAULT_LOCALE)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
