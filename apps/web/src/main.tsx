import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { routeTree } from './routeTree.gen'
import { trpc } from './trpc'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: 1000,
        staleTime: 5000,
      }
    }
  }))
  const [trpcClient] = useState(() => {

    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const defaultProdUrl = 'https://undertow-production-c0b8.up.railway.app';
    const apiUrl = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:3001' : defaultProdUrl);

    return trpc.createClient({
      links: [
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          headers: () => {
            const token = localStorage.getItem('undertow_token');
            return token ? { 'Authorization': `Bearer ${token}` } : {};
          }
        }),
      ],
    });

  })

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
