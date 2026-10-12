import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
const AlertDialogCancel = AlertDialogPrimitive.Cancel;
const AlertDialogAction = AlertDialogPrimitive.Action;

function AlertDialogOverlay({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> & {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Overlay>>;
}) {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      style={{ pointerEvents: 'none' }}
      className={cn(
        'fixed inset-0 z-1410 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  );
}
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

function AlertDialogContent({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Content>>;
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div
        data-slot="alert-dialog-positioner"
        className="pointer-events-none fixed inset-0 z-1420 grid place-items-center p-4"
      >
        <AlertDialogPrimitive.Content
          ref={ref}
          data-slot="alert-dialog-content"
          className={cn(
            'pointer-events-auto relative isolate flex w-[min(90vw,30rem)] transform-none flex-col gap-4 rounded-2xl border border-border bg-background p-6 text-foreground outline-none shadow-none data-[state=open]:animate-[dialog-content-in_180ms_cubic-bezier(0.16,1,0.3,1)_backwards] data-[state=closed]:animate-[dialog-content-out_140ms_ease-in_forwards]',
            className
          )}
          {...props}
        >
          {children}
        </AlertDialogPrimitive.Content>
      </div>
    </AlertDialogPortal>
  );
}
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)} {...props} />;
}
AlertDialogHeader.displayName = 'AlertDialogHeader';

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}
AlertDialogFooter.displayName = 'AlertDialogFooter';

function AlertDialogTitle({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title> & {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Title>>;
}) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

function AlertDialogDescription({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description> & {
  ref?: React.Ref<React.ComponentRef<typeof AlertDialogPrimitive.Description>>;
}) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
};
