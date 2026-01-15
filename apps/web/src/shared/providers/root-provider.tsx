"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit"
import { useState, type ReactNode } from "react"
import { createWagmiConfig } from "@/src/shared/config/wagmi"
import { TIME } from "@/src/shared/config/constants"

import "@rainbow-me/rainbowkit/styles.css"

interface RootProviderProps {
  children: ReactNode
}

export function RootProvider({ children }: RootProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: TIME.STALE_TIME,
            gcTime: TIME.CACHE_TIME,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  )

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ""
  const [wagmiConfig] = useState(() => createWagmiConfig(projectId))

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme({
              accentColor: "#1a2744",
              accentColorForeground: "white",
              borderRadius: "medium",
            }),
            darkMode: darkTheme({
              accentColor: "#3b82f6",
              accentColorForeground: "white",
              borderRadius: "medium",
            }),
          }}
          locale="es"
        >
          {children}
        </RainbowKitProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
