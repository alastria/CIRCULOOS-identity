"use client"

import type React from "react"
import { useAccount, useConnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { Wallet, ShieldAlert, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n/provider"
import { isAuthorizedAdmin } from "@/lib/wagmi"
import { useIsDiamondOwner } from "@/hooks/use-diamond-owner"

interface AdminAuthGateProps {
  children: React.ReactNode
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const { t } = useI18n()
  const { address, isConnected } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()

  // Check both: Diamond owner OR configured admin addresses
  const isDiamondOwner = useIsDiamondOwner(address)
  const isConfiguredAdmin = isConnected && address && isAuthorizedAdmin(address)
  const isAuthorized = isDiamondOwner || isConfiguredAdmin

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass glow-border max-w-md w-full">
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{t("admin.authGate.title")}</h2>
              <p className="text-muted-foreground">
                {t("admin.authGate.connectDescription")}
              </p>
            </div>
            <Button size="lg" className="gap-2" onClick={() => connect({ connector: injected() })} disabled={isConnecting}>
              <Wallet className="w-5 h-5" />
              {isConnecting ? t("admin.authGate.connecting") : t("wallet.connect")}
            </Button>
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
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-destructive">{t("admin.authGate.accessDenied")}</h2>
              <p className="text-muted-foreground mb-4">{t("admin.authGate.noPermissions")}</p>
              <code className="text-xs bg-secondary px-3 py-1 rounded-lg font-mono block mb-4">{address}</code>

              <div className="text-left bg-secondary/30 rounded-lg p-4 text-sm space-y-2">
                <p className="font-semibold"> {t("admin.authGate.accessAvailableFor")}</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t("admin.authGate.diamondOwner")}</li>
                  {isConfiguredAdmin && <li>{t("admin.authGate.configuredAddresses")}</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
