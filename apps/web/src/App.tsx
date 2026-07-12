import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { router } from './router';
import { TooltipProvider } from './components/ui/Tooltip';
import { Toaster } from './components/ui/Toast';
import { useThemeEffect } from './hooks/use-theme';

export function App() {
  useThemeEffect();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
