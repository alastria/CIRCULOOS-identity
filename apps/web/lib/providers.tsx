"use client"

import type React from "react"
import { I18nProvider } from "@/lib/i18n/provider"
import { ThemeProvider } from "@/components/theme-provider"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createWagmiConfig } from "@/src/shared/config/wagmi"

const queryClient = new QueryClient()
const wagmiConfig = createWagmiConfig(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "public")

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
