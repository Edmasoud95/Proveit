import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

function AppRoot() {
  const { toast } = useToast();

  const queryClient = useMemo(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => toast(error.message, 'error'),
        }),
        mutationCache: new MutationCache({
          onError: (error) => toast(error.message, 'error'),
        }),
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
    [toast],
  );

  return (
    <ErrorBoundary onError={(err) => toast(err.message, 'error')}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AppRoot />
    </ToastProvider>
  </React.StrictMode>,
);
