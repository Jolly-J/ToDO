import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';

function ScrollArea({
  className,
  children,
  ref,
  type = 'always',
  ...props
}: React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  ref?: React.Ref<React.ComponentRef<typeof ScrollAreaPrimitive.Root>>;
}) {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      type={type}
      data-slot="scroll-area"
      className={cn('group/scroll-area relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner className="bg-transparent" />
    </ScrollAreaPrimitive.Root>
  );
}
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

function ScrollBar({
  className,
  orientation = 'vertical',
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
  ref?: React.Ref<React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>>;
}) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        'pointer-events-none flex touch-none select-none p-0.5 opacity-0 transition-opacity duration-150 group-hover/scroll-area:pointer-events-auto group-hover/scroll-area:opacity-100 group-focus-within/scroll-area:pointer-events-auto group-focus-within/scroll-area:opacity-100 motion-reduce:transition-none',
        orientation === 'vertical'
          ? 'h-full w-[var(--tf-scrollbar-size)] border-l border-l-transparent'
          : 'h-[var(--tf-scrollbar-size)] flex-col border-t border-t-transparent',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-[var(--tf-scrollbar-thumb)] transition-colors hover:bg-[var(--tf-scrollbar-thumb-hover)] motion-reduce:transition-none"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
