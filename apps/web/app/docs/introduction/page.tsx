"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowRight,
  CheckCircle,
  Shield,
  Users,
  Building,
  Fingerprint,
  Globe,
  Key,
  Info,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"

export default function IntroductionPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">{t("docs.nav.documentation")}</Link>
        <span>/</span>
        <span className="text-foreground">{t("docs.nav.introduction")}</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          {t("docs.introduction.title")}
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          {t("docs.introduction.subtitle")}
        </p>
      </div>

      {/* Overview */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h2 id="vision-general">{t("docs.introduction.overview.title")}</h2>
        <p>
          {t("docs.introduction.overview.description")}
        </p>

        <Alert className="my-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t("docs.introduction.overview.w3cNote")}
          </AlertDescription>
        </Alert>
      </div>

      {/* Key Actors */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold" id="actores">{t("docs.introduction.actors.title")}</h2>
        <p className="text-muted-foreground">
          {t("docs.introduction.actors.description")}
        </p>
        
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Building className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="font-semibold">{t("docs.introduction.actors.issuer.title")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.actors.issuer.description")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <h3 className="font-semibold">{t("docs.introduction.actors.holder.title")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.actors.holder.description")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CheckCircle className="h-5 w-5 text-purple-500" />
                </div>
                <h3 className="font-semibold">{t("docs.introduction.actors.verifier.title")}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.actors.verifier.description")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold" id="como-funciona">{t("docs.introduction.howItWorks.title")}</h2>
        
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              1
            </div>
            <div>
              <h3 className="font-semibold mb-1">{t("docs.introduction.howItWorks.step1.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.howItWorks.step1.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              2
            </div>
            <div>
              <h3 className="font-semibold mb-1">{t("docs.introduction.howItWorks.step2.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.howItWorks.step2.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              3
            </div>
            <div>
              <h3 className="font-semibold mb-1">{t("docs.introduction.howItWorks.step3.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.howItWorks.step3.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              4
            </div>
            <div>
              <h3 className="font-semibold mb-1">{t("docs.introduction.howItWorks.step4.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.howItWorks.step4.description")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold" id="caracteristicas">{t("docs.introduction.features.title")}</h2>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex gap-3 p-4 rounded-lg border">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">{t("docs.introduction.features.decentralized.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.features.decentralized.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-4 rounded-lg border">
            <Fingerprint className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">{t("docs.introduction.features.privacy.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.features.privacy.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-4 rounded-lg border">
            <Globe className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">{t("docs.introduction.features.interoperable.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.features.interoperable.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-4 rounded-lg border">
            <Key className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">{t("docs.introduction.features.onchain.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("docs.introduction.features.onchain.description")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t">
        <div />
        <Link 
          href="/docs/introduction/concepts" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          {t("docs.nav.concepts")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
