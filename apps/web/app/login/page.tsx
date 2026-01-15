"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wallet, Loader2, Shield, Building2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAlastriaAuth } from "@/hooks/use-alastria-auth"
import { useConnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { useI18n } from "@/lib/i18n/provider"

export default function LoginPage() {
    const router = useRouter()
    const { t } = useI18n()
    const { signIn, isAuthenticating, authError, isAuthenticated, userRole, isConnected } = useAlastriaAuth()
    const { connect, isPending: isConnecting } = useConnect()

    // Redirect based on role after successful authentication
    useEffect(() => {
        if (isAuthenticated && userRole) {
            switch (userRole) {
                case 'admin':
                    router.push('/admin')
                    break
                case 'issuer':
                    router.push('/issuer')
                    break
                case 'holder':
                    router.push('/wallet')
                    break
                default:
                    router.push('/wallet')
            }
        }
    }, [isAuthenticated, userRole, router])

    const handleConnect = async () => {
        if (!isConnected) {
            await connect({ connector: injected() })
        }
    }

    const handleSignIn = async () => {
        // Global error handler (Toast) will show errors
        await signIn().catch(err => { }) // console.error('Login flow failed:', err))
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
            <Card className="glass glow-border max-w-md w-full">
                <CardHeader className="text-center space-y-2">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-10 h-10 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-bold">{t("login.title")}</CardTitle>
                    <CardDescription>
                        {t("login.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Role indicators */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-lg bg-secondary/50 border border-border/50">
                            <User className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{t("login.roles.holder")}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-secondary/50 border border-border/50">
                            <Building2 className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{t("login.roles.issuer")}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-secondary/50 border border-border/50">
                            <Shield className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{t("login.roles.admin")}</p>
                        </div>
                    </div>

                    {/* authError Alert removed - using global Toast */}

                    {!isConnected ? (
                        <Button
                            size="lg"
                            className="w-full gap-2"
                            onClick={handleConnect}
                            disabled={isConnecting}
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {t("login.buttons.connecting")}
                                </>
                            ) : (
                                <>
                                    <Wallet className="w-5 h-5" />
                                    {t("login.buttons.connectWallet")}
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            className="w-full gap-2"
                            onClick={handleSignIn}
                            disabled={isAuthenticating}
                        >
                            {isAuthenticating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {t("login.buttons.authenticating")}
                                </>
                            ) : (
                                <>
                                    <Shield className="w-5 h-5" />
                                    {t("login.buttons.signToAuth")}
                                </>
                            )}
                        </Button>
                    )}

                    <div className="text-center text-sm text-muted-foreground">
                        <p>{t("login.accessNote")}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
