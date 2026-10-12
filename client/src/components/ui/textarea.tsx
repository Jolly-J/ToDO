import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({
  className,
  ref,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-30 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
Textarea.displayName = 'Textarea';

export { Textarea };
