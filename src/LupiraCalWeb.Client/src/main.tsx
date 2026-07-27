import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './ui/navigation/router';
import { ApiError } from './data/fetcher';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx (e.g. a 404 on a synthetic birthday id) never succeeds on retry — surface it at once
      // instead of leaving the UI spinning; keep the default backoff for transient 5xx/network errors.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status >= 400 && error.status < 500 ? false : failureCount < 3,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
