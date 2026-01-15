"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wallet, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAlastriaAuth } from "@/hooks/use-alastria-auth"
import { useI18n } from "@/lib/i18n/provider"
import { useConnect } from "wagmi"
import { injected } from "wagmi/connectors"

interface IssuerAuthGateProps {
  children: React.ReactNode
}

export function IssuerAuthGate({ children }: IssuerAuthGateProps) {
  const { t } = useI18n()
  const router = useRouter()
  const { isAuthenticated, isAuthenticating, userRole, signIn, isConnected } = useAlastriaAuth()
  const { connect, isPending: isConnecting } = useConnect()

  // Redirect to login if not authenticated after mount
  useEffect(() => {
    if (!isAuthenticating && !isAuthenticated && isConnected) {
      // Connected but not authenticated - trigger SIWA
      signIn().catch(() => {
        router.push('/login')
      })
    }
  }, [isAuthenticated, isAuthenticating, isConnected, signIn, router])

  // Check if user has issuer or admin role
  const isAuthorized = isAuthenticated && (userRole === 'issuer' || userRole === 'admin')

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{t("issuer.authGate.title")}</h2>
              <p className="text-muted-foreground">
                {t("issuer.authGate.connectDescription")}
              </p>
            </div>
            <Button size="lg" className="gap-2" onClick={() => connect({ connector: injected() })} disabled={isConnecting}>
              <Wallet className="w-5 h-5" />
              {isConnecting ? t("issuer.authGate.connecting") : t("wallet.connect")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isAuthenticating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{t("issuer.authGate.authenticating")}</h2>
              <p className="text-muted-foreground">
                {t("issuer.authGate.signMessage")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full border-destructive/30">
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-destructive">{t("issuer.authGate.accessDenied")}</h2>
              <p className="text-muted-foreground mb-4">
                {t("issuer.authGate.noPermissions")}
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push('/')}>
              {t("issuer.authGate.backToHome")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
