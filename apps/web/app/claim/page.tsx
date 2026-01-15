"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, FileKey, Lock, ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useI18n } from "@/lib/i18n/provider"

export default function ManualClaimPage() {
  const { t } = useI18n()
  const router = useRouter()

  const [issuanceId, setIssuanceId] = useState("")
  const [claimToken, setClaimToken] = useState("")
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!issuanceId || !claimToken || otp.length !== 6) {
      setError(t("claim.manual.completeAllFields"))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Simulate API validation
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Redirect to claim page with token
      router.push(`/claim/${claimToken}`)
    } catch {
      setError(t("claim.manual.invalidData"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        {/* Back button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("common.backToHome")}
          </Link>

        <Card className="glass glow-border">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t("claim.manual.title")}</CardTitle>
            <CardDescription>
              {t("claim.manual.description")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Issuance ID */}
              <div className="space-y-2">
                <Label htmlFor="issuanceId" className="flex items-center gap-2">
                  <FileKey className="w-4 h-4" />
                  {t("claim.manual.issuanceId")}
                </Label>
                <Input
                  id="issuanceId"
                  placeholder={t("claim.manual.issuanceIdPlaceholder")}
                  value={issuanceId}
                  onChange={(e) => {
                    setIssuanceId(e.target.value)
                    setError(null)
                  }}
                  className="font-mono"
                />
              </div>

              {/* Claim Token */}
              <div className="space-y-2">
                <Label htmlFor="claimToken" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {t("claim.manual.claimToken")}
                </Label>
                <Input
                  id="claimToken"
                  type="password"
                  placeholder={t("claim.manual.tokenPlaceholder")}
                  value={claimToken}
                  onChange={(e) => {
                    setClaimToken(e.target.value)
                    setError(null)
                  }}
                />
              </div>

              {/* OTP */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  {t("claim.manual.otpCode")}
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => {
                      setOtp(value)
                      setError(null)
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading || !issuanceId || !claimToken || otp.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("claim.manual.validating")}
                  </>
                ) : (
                  t("claim.manual.continue")
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-muted-foreground">
                {t("claim.manual.noInvitation")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
