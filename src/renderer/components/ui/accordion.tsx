import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return (
    <div className={cn('divide-y divide-border-default rounded-lg border border-border-default overflow-hidden', className)}>
      {children}
    </div>
  );
}

interface AccordionItemContextValue {
  isOpen: boolean;
  toggle: () => void;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

function useAccordionItem() {
  const context = React.useContext(AccordionItemContext);
  if (!context) {
    throw new Error('AccordionItem components must be used within an AccordionItem');
  }
  return context;
}

interface AccordionItemProps {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function AccordionItem({ children, className, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <AccordionItemContext.Provider value={{ isOpen, toggle }}>
      <div className={cn('bg-bg-card', className)}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const { isOpen, toggle } = useAccordionItem();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg-hover transition-colors',
        className
      )}
    >
      <ChevronRight
        className={cn(
          'w-4 h-4 text-gray-500 transition-transform flex-shrink-0',
          isOpen && 'transform rotate-90'
        )}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { isOpen } = useAccordionItem();

  if (!isOpen) {
    return null;
  }

  return (
    <div className={cn('px-4 pb-4 pt-0 pl-11', className)}>
      {children}
    </div>
  );
}
