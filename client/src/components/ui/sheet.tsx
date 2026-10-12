import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Overlay>>;
}) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-1290 bg-black/20 backdrop-blur-sm data-[state=open]:animate-[overlay-in_200ms_ease-out] data-[state=closed]:animate-[overlay-out_150ms_ease-in]',
        className
      )}
      {...props}
    />
  );
}
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'top' | 'right' | 'bottom' | 'left';
}

function SheetContent({
  side = 'right',
  className,
  children,
  ref,
  ...props
}: SheetContentProps & {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Content>>;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-1300 flex flex-col gap-0 overflow-hidden border border-border bg-background text-foreground outline-none shadow-none',
          side === 'right' && 'right-5 top-5 bottom-5 w-[min(810px,calc(100vw-40px))] rounded-3xl border-l',
          side === 'left' && 'left-5 top-5 bottom-5 w-[min(810px,calc(100vw-40px))] rounded-3xl border-r',
          side === 'bottom' && 'bottom-0 left-0 h-[min(90vh,48rem)] w-full border-t',
          side === 'top' && 'left-0 top-0 h-[min(90vh,48rem)] w-full border-b',
          side === 'right' && 'data-[state=open]:animate-[sheet-in-right_300ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[sheet-out-right_200ms_ease-in]',
          side === 'left' && 'data-[state=open]:animate-[sheet-in-left_300ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[sheet-out-left_200ms_ease-in]',
          side === 'top' && 'data-[state=open]:animate-[sheet-in-top_300ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[sheet-out-top_200ms_ease-in]',
          side === 'bottom' && 'data-[state=open]:animate-[sheet-in-bottom_300ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[sheet-out-bottom_200ms_ease-in]',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}
SheetContent.displayName = DialogPrimitive.Content.displayName;

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 border-b border-border px-6 py-4', className)}
      {...props}
    />
  );
}
SheetHeader.displayName = 'SheetHeader';

function SheetTitle({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Title>>;
}) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}
SheetTitle.displayName = DialogPrimitive.Title.displayName;

function SheetDescription({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Description>>;
}) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
