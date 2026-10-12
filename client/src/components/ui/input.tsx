import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({
  className,
  type = 'text',
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-[var(--tf-density-control-height)] w-full rounded-[var(--tf-density-control-radius)] border border-border bg-background px-[var(--tf-density-control-padding-x)] py-[var(--tf-density-control-padding-y)] text-sm text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
Input.displayName = 'Input';

export { Input };
