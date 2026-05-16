import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './lib/trpc';
import { ThemeProvider } from './lib/theme';
import App from './App';
import './index.css';

// Scroll to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.querySelector('.staff-main');
    if (main) main.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Never retry auth/permission errors
        if (error?.data?.httpStatus === 401 || error?.data?.httpStatus === 403) return false;
        return failureCount < 1;
      },
      staleTime: 2 * 60 * 1000,   // 2 min — data stays fresh longer, fewer refetches
      gcTime: 10 * 60 * 1000,     // 10 min — keep cache alive across navigation
      refetchOnWindowFocus: false, // don't refetch just because user switched tabs
    },
  },
});
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)
  ? `${import.meta.env.VITE_API_URL}/trpc`
  : '/trpc';

const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: API_URL,
    headers() {
      const token = localStorage.getItem('auth-token');
      return token ? { Authorization: 'Bearer ' + token } : {};
    },
  })],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ThemeProvider>
            <ScrollToTop />
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
