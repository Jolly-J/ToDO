import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn('rounded-[var(--tf-density-card-radius)] border border-border bg-[rgba(250,250,248,0.92)] backdrop-blur-sm', className)}
      {...props}
    />
  );
}
Card.displayName = 'Card';

function CardHeader({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn('flex flex-col gap-1.5 px-[var(--tf-density-card-padding-x)] pt-[var(--tf-density-card-padding-y)] pb-2', className)} {...props} />;
}
CardHeader.displayName = 'CardHeader';

function CardTitle({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLHeadingElement> }) {
  return (
    <h3
      ref={ref}
      className={cn('text-[13px] font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}
CardTitle.displayName = 'CardTitle';

function CardContent({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn('px-[var(--tf-density-card-padding-x)] pb-[var(--tf-density-card-padding-y)]', className)} {...props} />;
}
CardContent.displayName = 'CardContent';

function CardFooter({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn('flex items-center gap-2 px-[var(--tf-density-card-padding-x)] pb-[var(--tf-density-card-padding-y)]', className)} {...props} />;
}
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
