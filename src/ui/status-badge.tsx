import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import { Badge } from '@/ui/primitives/badge';

export function StatusBadge({ status }: { status: 'CONFIRMED' | 'CANCELLED' }) {
  return status === 'CONFIRMED' ? (
    <Badge className="bg-success text-success-foreground">
      <CircleCheckIcon aria-hidden="true" data-icon="inline-start" />
      Confirmed
    </Badge>
  ) : (
    <Badge variant="secondary">
      <CircleXIcon aria-hidden="true" data-icon="inline-start" />
      Cancelled
    </Badge>
  );
}
