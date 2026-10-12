'use client';

import {
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type { Transition, Variants } from 'motion/react';
import { cn } from '@/lib/utils';
import useClickOutside from './useClickOutside';

const TRANSITION: Transition = {
  type: 'spring',
  bounce: 0.12,
  duration: 0.42,
};

type MorphingPopoverContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  uniqueId: string;
  variants?: Variants;
};

const MorphingPopoverContext = createContext<MorphingPopoverContextValue | null>(null);

function usePopoverLogic({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const uniqueId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isOpen = controlledOpen ?? uncontrolledOpen;

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return {
    isOpen,
    uniqueId,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen),
  };
}

export type MorphingPopoverProps = {
  children: ReactNode;
  transition?: Transition;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variants?: Variants;
  className?: string;
} & React.ComponentProps<'div'>;

function MorphingPopover({
  children,
  transition = TRANSITION,
  defaultOpen,
  open,
  onOpenChange,
  variants,
  className,
  ...props
}: MorphingPopoverProps) {
  const popoverLogic = usePopoverLogic({ defaultOpen, open, onOpenChange });

  return (
    <MorphingPopoverContext.Provider value={{ ...popoverLogic, variants }}>
      <MotionConfig transition={transition}>
        <div
          className={cn('relative flex items-center justify-center', className)}
          key={popoverLogic.uniqueId}
          {...props}
        >
          {children}
        </div>
      </MotionConfig>
    </MorphingPopoverContext.Provider>
  );
}

export type MorphingPopoverTriggerProps = {
  asChild?: boolean;
  children: ReactNode;
  className?: string;
} & React.ComponentProps<typeof motion.button>;

function MorphingPopoverTrigger({
  children,
  className,
  asChild = false,
  ...props
}: MorphingPopoverTriggerProps) {
  const context = useContext(MorphingPopoverContext);
  if (!context) {
    throw new Error('MorphingPopoverTrigger must be used within MorphingPopover');
  }

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    context.toggle();
  };

  if (asChild && isValidElement(children)) {
    const MotionComponent = motion.create(children.type as React.ForwardRefExoticComponent<any>);
    const childProps = children.props as Record<string, unknown>;

    return (
      <MotionComponent
        {...childProps}
        onClick={handleClick}
        layoutId={`popover-trigger-${context.uniqueId}`}
        className={childProps.className}
        key={context.uniqueId}
        aria-expanded={context.isOpen}
        aria-controls={`popover-content-${context.uniqueId}`}
      />
    );
  }

  return (
    <motion.button
      {...props}
      type={props.type ?? 'button'}
      layoutId={`popover-trigger-${context.uniqueId}`}
      key={context.uniqueId}
      className={className}
      onClick={handleClick}
      aria-expanded={context.isOpen}
      aria-controls={`popover-content-${context.uniqueId}`}
    >
      {children}
    </motion.button>
  );
}

export type MorphingPopoverContentProps = {
  children: ReactNode;
  className?: string;
  onExitComplete?: () => void;
} & React.ComponentProps<typeof motion.div>;

function MorphingPopoverContent({
  children,
  className,
  onExitComplete,
  ...props
}: MorphingPopoverContentProps) {
  const context = useContext(MorphingPopoverContext);
  if (!context) {
    throw new Error('MorphingPopoverContent must be used within MorphingPopover');
  }

  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, context.close);

  useEffect(() => {
    if (!context.isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        context.close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [context]);

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {context.isOpen ? (
        <motion.div
          {...props}
          ref={ref}
          layoutId={`popover-trigger-${context.uniqueId}`}
          key={context.uniqueId}
          id={`popover-content-${context.uniqueId}`}
          role="dialog"
          aria-modal="false"
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute right-0 top-0 overflow-hidden rounded-full border border-(--tf-border) bg-(--tf-background) text-(--tf-foreground) shadow-(--tf-floating-shadow)',
            className
          )}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={context.variants}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { MorphingPopover, MorphingPopoverTrigger, MorphingPopoverContent };
