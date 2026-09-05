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
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
