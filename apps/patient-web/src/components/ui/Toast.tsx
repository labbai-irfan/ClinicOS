import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { create } from 'zustand';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastTone = 'success' | 'danger' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (item: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (item) =>
    set((s) => ({ items: [...s.items, { ...item, id: crypto.randomUUID() }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'danger' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'info' }),
};

const toneIcon: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  danger: XCircle,
  info: Info,
};
const toneClass: Record<ToastTone, string> = {
  success: 'border-success/30 text-success',
  danger: 'border-danger/30 text-danger',
  info: 'border-info/30 text-info',
};

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {items.map((item) => {
        const Icon = toneIcon[item.tone];
        return (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && dismiss(item.id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border bg-surface p-4 shadow-popover',
              toneClass[item.tone],
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-text-primary">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-0.5 text-sm text-text-secondary">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close aria-label="Dismiss notification" className="text-text-secondary">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
