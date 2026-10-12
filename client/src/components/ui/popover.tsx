import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  portalContainer?: HTMLElement | null;
}

function PopoverContent({
  className,
  align = 'start',
  sideOffset = 8,
  collisionPadding = 12,
  portalContainer,
  ref,
  ...props
}: PopoverContentProps & {
  ref?: React.Ref<React.ComponentRef<typeof PopoverPrimitive.Content>>;
}) {
  return (
    <PopoverPrimitive.Portal container={portalContainer ?? undefined}>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-1500 w-80 rounded-xl border border-border bg-background p-3 text-foreground shadow-none outline-none data-[state=open]:animate-[popover-in_150ms_ease-out] data-[state=closed]:animate-[popover-out_100ms_ease-in]',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
